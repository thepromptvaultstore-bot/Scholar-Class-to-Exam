import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Camera, ChevronLeft, Crown, Flame, Lock, LogOut, Sparkles, Trophy } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getProfile, listNotes, listSubjects, updateProfile, uploadAvatar } from '../lib/data'
import { getLevelInfo, getStreakDays, listEarnedBadges } from '../lib/gamification'
import { getManageSubscriptionUrl } from '../lib/billing'
import { BADGE_CATALOG, DAILY_GOAL_PRESETS } from '../types/gamification'
import {
  FEATURE_LABEL,
  FREE_LIMITS,
  audioSecondsRemaining,
  formatMinutes,
  isPro,
  remaining,
  type MeteredFeature,
} from '../lib/entitlements'
import type { Profile } from '../types/domain'
import type { EarnedBadge, LevelInfo } from '../types/gamification'

function initials(name: string | null, email: string | null) {
  const source = (name || email || '?').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, signOut } = useAuthStore()
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [levelInfo, setLevelInfo] = useState<LevelInfo | null>(null)
  const [streak, setStreak] = useState(0)
  const [noteCount, setNoteCount] = useState(0)
  const [subjectCount, setSubjectCount] = useState(0)
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadge[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [savingGoal, setSavingGoal] = useState(false)
  const [savingDays, setSavingDays] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [university, setUniversity] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!user) return
      try {
        const [p, level, streakDays, notes, subjects, badges] = await Promise.all([
          getProfile(user.id, user.email ?? null),
          getLevelInfo(),
          getStreakDays(),
          listNotes(),
          listSubjects(),
          listEarnedBadges(),
        ])
        if (cancelled) return
        setProfile(p)
        setFullName(p.fullName ?? '')
        setUniversity(p.university ?? '')
        setLevelInfo(level)
        setStreak(streakDays)
        setNoteCount(notes.length)
        setSubjectCount(subjects.length)
        setEarnedBadges(badges)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your profile.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [user])

  const handleSave = async () => {
    if (!user) return
    setSaving(true)
    setError(null)
    setNotice(null)
    try {
      const updated = await updateProfile(
        user.id,
        {
          fullName: fullName.trim() || null,
          university: university.trim() || null,
        },
        user.email ?? null,
      )
      setProfile((prev) => (prev ? { ...prev, ...updated } : updated))
      setNotice('Saved.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your profile.')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = async (file: File) => {
    if (!user) return
    setUploadingAvatar(true)
    setError(null)
    try {
      const avatarUrl = await uploadAvatar(user.id, file)
      const updated = await updateProfile(user.id, { avatarUrl }, user.email ?? null)
      setProfile((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload that photo.')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const handleSetGoal = async (xp: number) => {
    if (!user || xp === profile?.dailyGoalXp) return
    setSavingGoal(true)
    try {
      const updated = await updateProfile(user.id, { dailyGoalXp: xp }, user.email ?? null)
      setProfile((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your daily goal.')
    } finally {
      setSavingGoal(false)
    }
  }

  // Which weekdays count toward the streak — a day left unchecked here
  // (typically a day with no class) doesn't need activity to keep the
  // streak alive, and won't cost a freeze either. Bit 0 = Sunday, matching
  // Date#getDay(), so a real class schedule (Sun/Tue/Wed/Thu, say) maps
  // straight onto the toggles below.
  const handleToggleStudyDay = async (dayIndex: number) => {
    if (!user || !profile) return
    const bit = 1 << dayIndex
    const isOn = (profile.streakActiveDaysMask & bit) !== 0
    const next = isOn ? profile.streakActiveDaysMask & ~bit : profile.streakActiveDaysMask | bit
    if (next === 0) return // at least one active day is required
    setSavingDays(true)
    try {
      const updated = await updateProfile(user.id, { streakActiveDaysMask: next }, user.email ?? null)
      setProfile((prev) => (prev ? { ...prev, ...updated } : updated))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update your study days.')
    } finally {
      setSavingDays(false)
    }
  }

  const earnedKeys = new Set(earnedBadges.map((b) => b.key))
  const dirty = profile !== null && (fullName !== (profile.fullName ?? '') || university !== (profile.university ?? ''))

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-10">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-1 text-muted">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">Profile</h1>
      </div>

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-500">{notice}</p>}

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : (
        <>
          <div className="glass-card flex flex-col items-center gap-3 rounded-2xl p-6 text-center">
            <button
              onClick={() => avatarInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-full"
              aria-label="Change profile photo"
            >
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center text-xl font-semibold text-white"
                  style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5 60%, #0891b2)' }}
                >
                  {initials(profile?.fullName ?? null, profile?.email ?? null)}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                <Camera size={18} className="text-white" />
              </div>
            </button>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleAvatarChange(f)
                e.target.value = ''
              }}
            />
            <div>
              <p className="text-base font-semibold text-gray-900 dark:text-white">
                {profile?.fullName || 'Add your name'}
              </p>
              <p className="text-xs text-muted">{profile?.email}</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="glass-card rounded-2xl p-3 text-center">
              <div className="mb-1 flex items-center justify-center gap-1 text-amber-500">
                <Sparkles size={14} />
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{levelInfo?.level ?? 1}</p>
              <p className="text-[11px] text-muted">Level</p>
            </div>
            <div className="glass-card rounded-2xl p-3 text-center">
              <div className="mb-1 flex items-center justify-center gap-1 text-orange-500">
                <Flame size={14} />
              </div>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{streak}</p>
              <p className="text-[11px] text-muted">
                Day streak{(profile?.streakFreezeCount ?? 0) > 0 ? ` · ${profile?.streakFreezeCount} freeze` : ''}
              </p>
            </div>
            <div className="glass-card rounded-2xl p-3 text-center">
              <p className="mb-1 text-[11px] font-medium text-indigo-500">{levelInfo?.totalXp ?? 0} XP</p>
              <p className="text-lg font-semibold text-gray-900 dark:text-white">{noteCount}</p>
              <p className="text-[11px] text-muted">Notes · {subjectCount} courses</p>
            </div>
          </div>

          <Link
            to="/league"
            className="glass-card flex items-center justify-between gap-3 rounded-2xl p-4 transition-transform hover:-translate-y-0.5"
          >
            <div className="flex items-center gap-2.5">
              <Trophy size={18} className="text-amber-500" />
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Friends & league</p>
                <p className="text-[11px] text-muted">Add friends and see this week's standings</p>
              </div>
            </div>
            <span className="text-xs font-medium text-indigo-500">Open →</span>
          </Link>

          {profile && (
            <div className="glass-card flex flex-col gap-3 rounded-2xl p-4">
              <div className="flex items-center justify-between">
                <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                  <Crown size={15} className={isPro(profile) ? 'text-amber-500' : 'text-muted'} />
                  {isPro(profile) ? 'Scholar Pro' : 'Free plan'}
                </h2>
                {!isPro(profile) && (
                  <Link to="/upgrade" className="text-xs font-semibold text-indigo-500">
                    Upgrade →
                  </Link>
                )}
              </div>
              {isPro(profile) ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-xs text-muted">
                    Unlimited practice sets, slide decks & page scans
                    {profile.subscriptionExpiresAt
                      ? ` · renews ${new Date(profile.subscriptionExpiresAt).toLocaleDateString()}`
                      : ''}
                  </p>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Lecture transcription</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatMinutes(audioSecondsRemaining(profile))} left this month
                    </span>
                  </div>
                  <a
                    href={getManageSubscriptionUrl()}
                    target="_blank"
                    rel="noreferrer"
                    className="self-start text-xs font-medium text-indigo-500"
                  >
                    Manage or cancel subscription →
                  </a>
                </div>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {(Object.keys(FEATURE_LABEL) as MeteredFeature[]).map((key) => (
                    <div key={key} className="flex items-center justify-between text-xs">
                      <span className="text-muted">{FEATURE_LABEL[key]}</span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {remaining(profile, key)} / {FREE_LIMITS[key]} left
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted">Lecture transcription</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatMinutes(audioSecondsRemaining(profile))} / 30 min left
                    </span>
                  </div>
                  <p className="text-[11px] text-muted">
                    One-time allowance, not monthly — upgrade for a 12-hour refill every month.
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="glass-card flex flex-col gap-3 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Daily goal</h2>
            <div className="grid grid-cols-4 gap-2">
              {DAILY_GOAL_PRESETS.map((preset) => {
                const active = (profile?.dailyGoalXp ?? 30) === preset.xp
                return (
                  <button
                    key={preset.tier}
                    onClick={() => handleSetGoal(preset.xp)}
                    disabled={savingGoal}
                    className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-2.5 text-center transition-colors ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
                        : 'border-black/10 text-muted dark:border-white/15'
                    }`}
                  >
                    <span className="text-xs font-semibold">{preset.label}</span>
                    <span className="text-[10px]">{preset.xp} XP</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div className="glass-card flex flex-col gap-3 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Study days</h2>
            <p className="text-xs text-muted">
              Only these days need activity to keep your streak going — handy if you don't have class
              (or don't study) every day. Freezes won't be spent covering an unchecked day either.
            </p>
            <div className="grid grid-cols-7 gap-1.5">
              {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((label, i) => {
                const active = ((profile?.streakActiveDaysMask ?? 127) & (1 << i)) !== 0
                return (
                  <button
                    key={i}
                    onClick={() => handleToggleStudyDay(i)}
                    disabled={savingDays}
                    title={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][i]}
                    className={`rounded-xl border py-2 text-center text-xs font-semibold transition-colors ${
                      active
                        ? 'border-indigo-500 bg-indigo-500/10 text-indigo-500'
                        : 'border-black/10 text-muted dark:border-white/15'
                    }`}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="glass-card flex flex-col gap-3 rounded-2xl p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
              <Trophy size={15} className="text-amber-500" /> Badges
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {BADGE_CATALOG.map((badge) => {
                const earned = earnedKeys.has(badge.key)
                return (
                  <div
                    key={badge.key}
                    title={`${badge.label} — ${badge.description}`}
                    className={`flex flex-col items-center gap-1 rounded-xl p-2 text-center ${
                      earned ? 'bg-amber-500/10' : 'bg-black/[0.03] dark:bg-white/[0.05]'
                    }`}
                  >
                    {earned ? (
                      <Trophy size={18} className="text-amber-500" />
                    ) : (
                      <Lock size={16} className="text-muted opacity-50" />
                    )}
                    <span className={`text-[9.5px] leading-tight ${earned ? 'text-gray-900 dark:text-white' : 'text-muted'}`}>
                      {badge.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="glass-card flex flex-col gap-3 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Your details</h2>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">Full name</label>
              <input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="input-field"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted">University / college</label>
              <input
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="e.g. North South University"
                className="input-field"
              />
            </div>
            {dirty && (
              <button onClick={handleSave} disabled={saving} className="btn-primary self-start !py-2.5 text-xs">
                {saving ? 'Saving…' : 'Save changes'}
              </button>
            )}
          </div>

          <button
            onClick={() => signOut()}
            className="btn-secondary justify-center !text-red-500"
          >
            <LogOut size={15} /> Sign out
          </button>

          <p className="pb-2 text-center text-[11px] text-muted">
            <Link to="/terms" className="text-indigo-500">
              Terms
            </Link>{' '}
            ·{' '}
            <Link to="/privacy" className="text-indigo-500">
              Privacy Policy
            </Link>
          </p>
        </>
      )}
    </div>
  )
}
