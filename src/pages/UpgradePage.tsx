import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Crown, Check, Sparkles } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getProfile } from '../lib/data'
import {
  fetchProPlanPrices,
  getManageSubscriptionUrl,
  purchasePro,
  restorePro,
  PLAN_MONTHLY,
  PLAN_YEARLY,
} from '../lib/billing'
import { FEATURE_LABEL, FREE_LIMITS } from '../lib/entitlements'

const FALLBACK_PRICE: Record<string, string> = {
  [PLAN_MONTHLY]: '$6.99/month',
  [PLAN_YEARLY]: '$39.99/year',
}

const PLAN_COPY: Record<string, { label: string; sub: string }> = {
  [PLAN_MONTHLY]: { label: 'Monthly', sub: 'Cancel anytime' },
  [PLAN_YEARLY]: { label: 'Yearly', sub: 'Save over 50% vs. monthly' },
}

export default function UpgradePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [prices, setPrices] = useState<Record<string, string | null>>({})
  const [selected, setSelected] = useState<typeof PLAN_MONTHLY | typeof PLAN_YEARLY>(PLAN_YEARLY)
  const [purchasing, setPurchasing] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchProPlanPrices().then((plans) => {
      if (cancelled) return
      const map: Record<string, string | null> = {}
      for (const p of plans) map[p.planId] = p.priceString
      setPrices(map)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const handlePurchase = async () => {
    setError(null)
    setNotice(null)
    setPurchasing(true)
    try {
      const result = await purchasePro(selected)
      if (result.tier === 'pro') {
        setNotice("You're on Scholar Pro — unlimited AI, no monthly limits.")
        if (user) await getProfile(user.id, user.email ?? null)
        setTimeout(() => navigate('/profile'), 1200)
      } else {
        setError('The purchase went through Google Play but could not be verified yet. Try "Restore purchases" in a moment.')
      }
    } catch (err) {
      // A user-cancelled purchase sheet rejects too — don't scare them with
      // a red error banner for simply backing out.
      const message = err instanceof Error ? err.message : String(err)
      if (!/cancel/i.test(message)) setError(message)
    } finally {
      setPurchasing(false)
    }
  }

  const handleRestore = async () => {
    setError(null)
    setNotice(null)
    setRestoring(true)
    try {
      const result = await restorePro()
      if (result.tier === 'pro') {
        setNotice("Restored — you're on Scholar Pro.")
        setTimeout(() => navigate('/profile'), 1200)
      } else {
        setNotice('No active Scholar Pro purchase found on this Google account.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore purchases.')
    } finally {
      setRestoring(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-10">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-1 text-muted">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Scholar Pro</h1>
      </div>

      <div
        className="flex flex-col items-center gap-1 rounded-2xl p-6 text-center text-white"
        style={{
          background: 'linear-gradient(135deg, #2563eb, #4f46e5 60%, #0891b2)',
          boxShadow: '0 12px 28px -10px rgba(37, 99, 235, 0.55)',
        }}
      >
        <Crown size={26} />
        <p className="mt-1 text-base font-semibold">Unlimited practice, slides & scans</p>
        <p className="text-xs opacity-90">Plus 12 hours of lecture transcription every month</p>
      </div>

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-500">{notice}</p>}

      <div className="glass-card flex flex-col gap-2.5 rounded-2xl p-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Free vs. Pro</h2>
        {(Object.keys(FEATURE_LABEL) as Array<keyof typeof FEATURE_LABEL>).map((key) => (
          <div key={key} className="flex items-center justify-between text-sm">
            <span className="text-gray-900 dark:text-white">{FEATURE_LABEL[key]}</span>
            <span className="text-xs text-muted">{FREE_LIMITS[key]} once → Unlimited</span>
          </div>
        ))}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-900 dark:text-white">Lecture transcription</span>
          <span className="text-xs text-muted">30 min once → 12 hrs/month</span>
        </div>
        <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-500">
          <Check size={13} /> Priority-friendly — never blocked mid-study session
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        {[PLAN_YEARLY, PLAN_MONTHLY].map((planId) => {
          const active = selected === planId
          return (
            <button
              key={planId}
              onClick={() => setSelected(planId as typeof PLAN_MONTHLY | typeof PLAN_YEARLY)}
              className={`glass-card flex items-center justify-between rounded-2xl p-4 text-left transition-colors ${
                active ? 'border-2 !border-indigo-500' : ''
              }`}
            >
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{PLAN_COPY[planId].label}</p>
                <p className="text-[11px] text-muted">{PLAN_COPY[planId].sub}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {prices[planId] ?? FALLBACK_PRICE[planId]}
                </p>
                {planId === PLAN_YEARLY && <p className="text-[10px] text-emerald-500">Best value</p>}
              </div>
            </button>
          )
        })}
      </div>

      <button onClick={handlePurchase} disabled={purchasing} className="btn-primary">
        <Sparkles size={15} /> {purchasing ? 'Processing…' : 'Upgrade to Scholar Pro'}
      </button>

      <button onClick={handleRestore} disabled={restoring} className="text-center text-xs text-muted underline">
        {restoring ? 'Checking…' : 'Restore purchases'}
      </button>

      <p className="text-center text-[10.5px] text-muted">
        Billed through your Google Play account.{' '}
        <a href={getManageSubscriptionUrl()} target="_blank" rel="noreferrer" className="text-indigo-500 underline">
          Manage or cancel anytime
        </a>{' '}
        in Google Play &gt; Subscriptions.
      </p>
    </div>
  )
}
