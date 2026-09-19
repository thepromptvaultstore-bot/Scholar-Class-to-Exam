# Scholar Pro — Google Play Billing setup

This is the manual, one-time setup for the subscription system just added to the app. None of it can be done from here — it needs your Play Console account, a Google Cloud project, and your Supabase project — so this is the exact sequence to run through.

**Pricing implemented:** Scholar Pro at $6.99/month or $39.99/year (~$3.33/mo, a 52% discount for annual). Free users get 5 practice sets, 5 slide decks, 5 page scans, and 5 lecture transcriptions per calendar month; Pro removes all four caps. These numbers live in `supabase/functions/_shared/entitlements.ts` (server) and `src/lib/entitlements.ts` (client display) if you ever want to change them — edit both together.

## 1. Run the database migration

In the Supabase SQL editor (or via the CLI if you have it linked to this project), run the new migration:

```
supabase db push
```

or paste the contents of `supabase/migrations/0011_subscriptions.sql` directly into the SQL editor and run it. This adds the subscription/usage columns to `profiles` **and** locks down which columns a signed-in user's own client can write directly — without that lockdown, a user could open dev tools and grant themselves Pro for free, so don't skip this even if you're just testing.

## 2. Deploy the edge functions

Four existing functions were changed (they now check/consume the free-tier allowance) and one is brand new:

```
supabase functions deploy generate-practice
supabase functions deploy generate-slides
supabase functions deploy transcribe-image
supabase functions deploy transcribe-audio
supabase functions deploy verify-purchase
```

`verify-purchase` needs two secrets before it will work (step 4 below sets these) — until then it will fail with a clear "not set as function secrets" error rather than silently misbehaving.

## 3. Create the subscription in Play Console

1. Play Console → your app → **Monetize → Products → Subscriptions**.
2. Create a new subscription with **Product ID: `scholar_pro`** (must match exactly — it's hardcoded in `src/lib/billing.ts` as `SCHOLAR_PRO_PRODUCT_ID`).
3. Add two **base plans**:
   - Base plan ID **`monthly`** — auto-renewing, billing period 1 month, price **$6.99** (set your own price if you want to adjust from the researched range; Play lets you set different prices per country/currency).
   - Base plan ID **`yearly`** — auto-renewing, billing period 1 year, price **$39.99**.
   - Base plan IDs must be exactly `monthly` and `yearly` — they're hardcoded in `src/lib/billing.ts` as `PLAN_MONTHLY` / `PLAN_YEARLY`.
4. Activate both base plans.
5. Add your app's package name if it isn't already linked: **`com.thepromptvault.scholar`**.

You can't test a real purchase until the app with this billing code is uploaded to at least an **Internal testing** track in Play Console (Play Billing refuses to sell products for an app version it hasn't seen), and you'll need to add your own Google account as a **license tester** (Play Console → Setup → License testing) so test purchases don't charge a real card.

## 4. Create the Google Cloud service account (for server-side purchase verification)

This is what lets `verify-purchase` confirm a purchase really happened, rather than trusting the app's word for it.

1. Go to [Google Cloud Console](https://console.cloud.google.com/) and either use the auto-created project linked to your Play Console account, or create a new one.
2. **APIs & Services → Library** → enable the **Google Play Android Developer API**.
3. **IAM & Admin → Service Accounts** → **Create service account** (any name, e.g. "scholar-play-billing"). No roles need to be granted here — access is granted from the Play Console side instead.
4. Open the new service account → **Keys** tab → **Add key → Create new key → JSON**. This downloads a `.json` file — keep it private, it's a credential.
5. Back in **Play Console → Setup → API access**, find the service account you just created (it may take a minute to appear) and **grant access**. Give it these two permissions under "App permissions" for Scholar:
   - **View app information (read-only)**
   - **View financial data, orders, and cancellation survey responses**
   - **Manage orders and subscriptions**

## 5. Set the Supabase secrets

Open the JSON key file you downloaded in step 4, and set its entire contents (the whole JSON, as one value) as a secret:

```
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<paste the full contents of the downloaded .json file here>'
supabase secrets set ANDROID_PACKAGE_NAME=com.thepromptvault.scholar
```

On Windows, the JSON file has literal newlines in the private key (`\n` inside a quoted string, which is fine — it's valid JSON either way), so pasting the whole file's text between the single quotes as-is should work in PowerShell or a normal terminal.

## 6. Install the new dependency and re-sync Android

`package.json` now includes `@capgo/native-purchases` (a free, open-source Capacitor plugin — no RevenueCat account or extra subscription needed). On your machine, in the project folder:

```
npm install
npx cap sync android
```

`npx cap sync android` regenerates the same two files I already updated (`android/capacitor.settings.gradle` and `android/app/capacitor.build.gradle`) from your local `node_modules`, so running it again is just confirming the plugin is properly linked before you open Android Studio.

## 7. Build, test on Internal testing track, then verify

1. Build a release AAB and upload it to Play Console's **Internal testing** track (Play Billing purchases don't work at all against an app that Play has never seen — this is a Play requirement, not something in the app's code).
2. Install the app from that internal testing link on a real device signed in with your **license tester** Google account.
3. Open the app → Profile → Upgrade → try both the monthly and yearly plan. As a license tester, Google shows a "Test card, will not be charged" banner during checkout.
4. After a successful test purchase, check the app immediately shows "Scholar Pro" on the Profile page — that confirms `verify-purchase` reached the Play Developer API, verified the token, and updated your profile row. If it doesn't, check the `verify-purchase` function's logs in Supabase (Functions → verify-purchase → Logs) for the exact error — the most common first-time issues are the service account not yet having propagated its Play Console permissions (can take a few minutes), or a typo in the pasted JSON secret.
5. In Play Console → License testing, you can cancel/refund test purchases so they don't linger on your test account.

## What's already done and doesn't need any action

- The four AI edge functions (practice, slides, scans, lecture transcription) now check the caller's plan and monthly usage before spending money on the Anthropic/transcription API call, and return a friendly "upgrade" message once a free user hits their limit — the app shows this with an inline "Upgrade to Scholar Pro" link rather than a raw error.
- The Profile page shows the current plan and, for free users, how many of each free action are left this month.
- `src/pages/UpgradePage.tsx` is the purchase screen (`/upgrade` route) — it fetches live prices from the Play Store when available and falls back to the plain-text prices above if the store can't be reached (e.g. testing in a browser instead of the Android app, where Play Billing doesn't exist at all).
- A "Restore purchases" button on that screen re-verifies an existing subscription against Google Play — useful after a reinstall or a new device.
