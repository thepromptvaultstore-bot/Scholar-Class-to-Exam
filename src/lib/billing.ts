// Google Play Billing for Scholar Pro, via @capgo/native-purchases — a free,
// open-source Capacitor plugin that wraps the Play Billing Library directly
// (no RevenueCat account, no third-party subscription fee). Every purchase
// is verified server-side by the verify-purchase edge function before the
// user's profile is ever marked 'pro' — this file only starts the native
// purchase flow and hands the result off for verification.
//
// Play Console setup this depends on (see play-billing-setup.md at the repo
// root for the full walkthrough): one subscription product with id
// SCHOLAR_PRO_PRODUCT_ID, with two base plans named PLAN_MONTHLY / PLAN_YEARLY.
import { NativePurchases, PURCHASE_TYPE, type Product } from '@capgo/native-purchases'
import { supabase } from './supabaseClient'

export const SCHOLAR_PRO_PRODUCT_ID = 'scholar_pro'
export const PLAN_MONTHLY = 'monthly'
export const PLAN_YEARLY = 'yearly'
const ANDROID_PACKAGE_ID = 'com.thepromptvault.scholar'

// Play Billing has no in-app "cancel subscription" API — a purchase can only
// be changed or cancelled from Play Store's own subscription-management
// screen. This deep-links straight to this app's Scholar Pro subscription
// there (Play Store app on Android, the Play Store website in a browser).
export function getManageSubscriptionUrl(): string {
  return `https://play.google.com/store/account/subscriptions?sku=${SCHOLAR_PRO_PRODUCT_ID}&package=${ANDROID_PACKAGE_ID}`
}

export interface ProPlanOption {
  planId: typeof PLAN_MONTHLY | typeof PLAN_YEARLY
  priceString: string | null
}

// Returns live, localized prices for both plans (null price if the store
// couldn't be reached — the Upgrade page falls back to the plain-text price
// baked into its copy in that case).
export async function fetchProPlanPrices(): Promise<ProPlanOption[]> {
  const plans: Array<typeof PLAN_MONTHLY | typeof PLAN_YEARLY> = [PLAN_MONTHLY, PLAN_YEARLY]
  try {
    const { products } = await NativePurchases.getProducts({
      productIdentifiers: [SCHOLAR_PRO_PRODUCT_ID],
      productType: PURCHASE_TYPE.SUBS,
    })
    return plans.map((planId) => ({
      planId,
      priceString: (products as Product[]).find((p) => p.identifier === planId)?.priceString ?? null,
    }))
  } catch {
    return plans.map((planId) => ({ planId, priceString: null }))
  }
}

export async function isBillingAvailable(): Promise<boolean> {
  try {
    const { isBillingSupported } = await NativePurchases.isBillingSupported()
    return isBillingSupported
  } catch {
    return false
  }
}

async function verifyWithServer(purchaseToken: string, productId: string) {
  const { data, error } = await supabase.functions.invoke('verify-purchase', {
    body: { purchaseToken, productId },
  })
  if (error) throw error
  return data as { tier: 'free' | 'pro'; expiresAt: string | null }
}

// Starts the native Play Billing purchase sheet for one plan, then verifies
// the result server-side. Throws on cancel/failure (the purchase sheet's own
// "cancel" also rejects — callers should treat that as a silent no-op, not
// an error banner).
export async function purchasePro(planId: typeof PLAN_MONTHLY | typeof PLAN_YEARLY) {
  const transaction = await NativePurchases.purchaseProduct({
    productIdentifier: SCHOLAR_PRO_PRODUCT_ID,
    planIdentifier: planId,
    productType: PURCHASE_TYPE.SUBS,
  })
  if (!transaction.purchaseToken) {
    throw new Error('Purchase completed but Google Play did not return a purchase token.')
  }
  return verifyWithServer(transaction.purchaseToken, SCHOLAR_PRO_PRODUCT_ID)
}

// Re-checks an existing purchase (app reinstall, new device, or "Restore
// purchases" button) against the Play Store and re-syncs the profile.
export async function restorePro(): Promise<{ tier: 'free' | 'pro'; expiresAt: string | null }> {
  await NativePurchases.restorePurchases()
  const { purchases } = await NativePurchases.getPurchases({ productType: PURCHASE_TYPE.SUBS })
  const active = purchases.find((p) => p.productIdentifier === SCHOLAR_PRO_PRODUCT_ID && p.purchaseToken)
  if (!active?.purchaseToken) {
    return { tier: 'free', expiresAt: null }
  }
  return verifyWithServer(active.purchaseToken, SCHOLAR_PRO_PRODUCT_ID)
}
