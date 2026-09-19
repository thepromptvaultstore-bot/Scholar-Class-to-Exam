// Supabase Edge Function: verify-purchase
//
// Called by the client right after Google Play Billing reports a successful
// purchase (or on app start, to re-check an existing subscriber's status).
// Never trusts the client's word that a purchase happened — it takes the
// purchase token the Play Billing Library handed back, verifies it directly
// against the Google Play Developer API using a service-account credential,
// and only then flips the user's own profile row to subscription_tier='pro'.
// This is also the ONLY path that can set subscription_tier, because the
// 0011_subscriptions.sql migration revokes column-level UPDATE on that
// column (and the other subscription/usage columns) from the `authenticated`
// role — a signed-in user's own client can no longer grant itself Pro by
// calling `.from('profiles').update(...)` directly.
//
// Setup (see play-billing-setup.md at the repo root for the full walkthrough):
//   1. Google Cloud service account with the "Pub/Sub Editor" role is NOT
//      needed here — this only needs read access to purchase state, granted
//      by linking the service account in Play Console (Setup > API access)
//      with the "View financial data" + "Manage orders and subscriptions"
//      permissions.
//   2. supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<the full JSON key file contents>'
//   3. supabase secrets set ANDROID_PACKAGE_NAME=com.thepromptvault.scholar
//   4. supabase functions deploy verify-purchase
//
// Request body: { purchaseToken: string, productId: string }
// (productId is the Play Console subscription product id, e.g. "scholar_pro" —
// used only for the response/bookkeeping, never trusted for entitlement)
// Response: { tier: 'free' | 'pro', expiresAt: string | null }

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// --- Minimal RS256 JWT signing (Google's service-account "JWT Bearer" OAuth
// flow) using only Web Crypto, so this needs no extra npm/jsr dependency. ---
function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const b of buf) binary += String.fromCharCode(b)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function importServiceAccountKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s+/g, '')
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
}

async function getGoogleAccessToken(serviceAccount: { client_email: string; private_key: string }) {
  const now = Math.floor(Date.now() / 1000)
  const header = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })))
  const claims = base64url(
    new TextEncoder().encode(
      JSON.stringify({
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/androidpublisher',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now,
      }),
    ),
  )
  const unsigned = `${header}.${claims}`
  const key = await importServiceAccountKey(serviceAccount.private_key)
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )
  const jwt = `${unsigned}.${base64url(signature)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  if (!res.ok) throw new Error(`Google OAuth token error ${res.status}: ${await res.text()}`)
  const json = await res.json()
  return json.access_token as string
}

// Active-ish states per Google's SubscriptionState enum — SUBSCRIPTION_STATE_
// prefix stripped for readability. Grace period still counts as "pro" so a
// card that needs updating doesn't instantly lock the user out mid-renewal.
const ACTIVE_STATES = new Set(['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { purchaseToken, productId } = await req.json()
    if (!purchaseToken) {
      return new Response(JSON.stringify({ error: 'purchaseToken is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    // Identify the caller from their own session — never from a client-
    // supplied userId, since this function is what's allowed to grant Pro.
    const authHeader = req.headers.get('Authorization') ?? ''
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )
    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Not signed in' }), {
        status: 401,
        headers: corsHeaders,
      })
    }

    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    const packageName = Deno.env.get('ANDROID_PACKAGE_NAME')
    if (!serviceAccountJson || !packageName) {
      throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON / ANDROID_PACKAGE_NAME not set as function secrets')
    }
    const serviceAccount = JSON.parse(serviceAccountJson)
    const accessToken = await getGoogleAccessToken(serviceAccount)

    const verifyUrl =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${packageName}` +
      `/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`
    const verifyRes = await fetch(verifyUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!verifyRes.ok) {
      throw new Error(`Play Developer API error ${verifyRes.status}: ${await verifyRes.text()}`)
    }
    const subscription = await verifyRes.json()

    const isActive = ACTIVE_STATES.has(subscription.subscriptionState)
    // expiryTime lives per line item; take the latest one on the purchase.
    const expiryTime: string | null =
      subscription.lineItems?.map((li: { expiryTime?: string }) => li.expiryTime).filter(Boolean).sort().pop() ??
      null

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (isActive) {
      await supabase
        .from('profiles')
        .update({
          subscription_tier: 'pro',
          subscription_expires_at: expiryTime,
          subscription_product_id: productId ?? null,
          subscription_purchase_token: purchaseToken,
        })
        .eq('id', user.id)
      return new Response(JSON.stringify({ tier: 'pro', expiresAt: expiryTime }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Not active (expired/canceled/paused/revoked) — only downgrade if this
    // token is the one currently on file, so re-verifying an old, already-
    // superseded token can never stomp on a separately-active subscription.
    await supabase
      .from('profiles')
      .update({ subscription_tier: 'free', subscription_expires_at: null })
      .eq('id', user.id)
      .eq('subscription_purchase_token', purchaseToken)

    return new Response(JSON.stringify({ tier: 'free', expiresAt: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
