// Supabase Edge Function: add-friend
//
// Adds a friend by their 6-character friend code. This has to be an edge
// function (rather than a client-side insert) for two reasons: (1) looking
// up another user's profile by code requires reading a row RLS wouldn't let
// the caller see ("profiles: read own" only), and (2) a symmetric
// friendship needs a row written under *each* user's id, and RLS only lets
// a user insert rows where user_id = themselves — the reverse row is
// written here with the service role instead. Same "cross-user read/write
// goes through a service-role edge function" pattern as get-shared.
//
// Deploy:  supabase functions deploy add-friend
//
// Request body: { userId: string, code: string }
// Response:     { error: string } | { friend: { id, fullName, avatarUrl } }

import { createClient } from 'jsr:@supabase/supabase-js@2'

// Browsers preflight a cross-origin POST with a JSON body via an OPTIONS
// request; without these headers the browser blocks the real request
// before it's even sent, which surfaces in the app as "Failed to send a
// request to the Edge Function" (a network-level failure, not a function
// error — no amount of fixing the function body helps without this).
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { userId, code } = await req.json()
    if (!userId || !code || typeof code !== 'string') {
      return new Response(JSON.stringify({ error: 'userId and code are required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const normalized = code.trim().toUpperCase()

    const { data: friend, error: lookupError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('friend_code', normalized)
      .maybeSingle()
    if (lookupError) throw lookupError

    if (!friend) {
      return new Response(JSON.stringify({ error: "No Scholar user has that friend code." }), {
        status: 404,
        headers: corsHeaders,
      })
    }
    if (friend.id === userId) {
      return new Response(JSON.stringify({ error: "That's your own friend code." }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const { data: existing, error: existingError } = await supabase
      .from('friendships')
      .select('id')
      .eq('user_id', userId)
      .eq('friend_id', friend.id)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) {
      return new Response(JSON.stringify({ error: 'You are already friends.' }), {
        status: 409,
        headers: corsHeaders,
      })
    }

    const { error: insertError } = await supabase.from('friendships').insert([
      { user_id: userId, friend_id: friend.id },
      { user_id: friend.id, friend_id: userId },
    ])
    if (insertError) throw insertError

    return new Response(
      JSON.stringify({
        friend: { id: friend.id, fullName: friend.full_name, avatarUrl: friend.avatar_url },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
