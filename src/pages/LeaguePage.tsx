import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft, Copy, Flame, Trophy, UserPlus, Users } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { getProfile } from '../lib/data'
import { fetchFriendsBoard, addFriendByCode, removeFriend, type FriendsBoard } from '../lib/friends'
import { checkWeeklyLeagueRollover } from '../lib/gamification'
import { LEAGUE_TIERS } from '../types/gamification'
import type { LeagueTier } from '../types/database'
import type { Profile } from '../types/domain'

function initials(name: string | null) {
  const source = (name || '?').trim()
  const parts = source.split(/\s+/).filter(Boolean)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return source.slice(0, 2).toUpperCase()
}

export default function LeaguePage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()

  const [profile, setProfile] = useState<Profile | null>(null)
  const [board, setBoard] = useState<FriendsBoard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const [code, setCode] = useState('')
  const [adding, setAdding] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = async () => {
    if (!user) return
    const [p, b] = await Promise.all([getProfile(user.id, user.email ?? null), fetchFriendsBoard(user.id, 0)])
    setProfile(p)
    setBoard(b)
    return p
  }

  useEffect(() => {
    let cancelled = false
    async function init() {
      if (!user) return
      // Render as soon as the first board load lands instead of also
      // waiting on the weekly-rollover check below — that check only
      // matters once a week (new Monday) and otherwise short-circuits, but
      // when it DOES run it costs 1-2 extra edge-function round trips, and
      // blocking the whole page on it is what made League feel stuck on
      // "Loading…" for several seconds.
      let p: Profile | null = null
      try {
        p = (await load()) ?? null
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load your league.')
      } finally {
        if (!cancelled) setLoading(false)
      }
      if (cancelled || !p) return
      try {
        const newTier = await checkWeeklyLeagueRollover(user.id, p.leagueTier, p.leagueWeekKey)
        if (!cancelled && newTier) {
          setNotice(
            newTier === p.leagueTier ? null : `Your league changed for this week — refreshing…`,
          )
          await load()
        }
      } catch {
        // Best-effort background check — the board the user already sees is
        // still correct, so a failure here shouldn't surface as a page error.
      }
    }
    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user])

  const handleAddFriend = async () => {
    if (!user || !code.trim()) return
    setAdding(true)
    setError(null)
    setNotice(null)
    try {
      const friend = await addFriendByCode(user.id, code.trim())
      setNotice(`Added ${friend.fullName || 'your friend'}!`)
      setCode('')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add that friend.')
    } finally {
      setAdding(false)
    }
  }

  const handleRemoveFriend = async (friendId: string) => {
    if (!user) return
    try {
      await removeFriend(user.id, friendId)
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove that friend.')
    }
  }

  const handleCopyCode = async () => {
    if (!profile?.friendCode) return
    try {
      await navigator.clipboard.writeText(profile.friendCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const tierInfo = LEAGUE_TIERS.find((t) => t.tier === (profile?.leagueTier ?? ('bronze' as LeagueTier)))!

  const standings = board
    ? [
        { id: user?.id ?? 'me', fullName: profile?.fullName ?? 'You', avatarUrl: profile?.avatarUrl ?? null, weeklyXp: board.self.weeklyXp, isSelf: true },
        ...board.friends.map((f) => ({ id: f.id, fullName: f.fullName, avatarUrl: f.avatarUrl, weeklyXp: f.weeklyXp, isSelf: false })),
      ].sort((a, b) => b.weeklyXp - a.weeklyXp)
    : []

  return (
    <div className="flex flex-col gap-5 px-5 pt-6 pb-10">
      <div className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="p-1 text-muted">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white">League</h1>
      </div>

      {error && <p className="rounded-xl bg-red-500/10 p-3 text-xs text-red-500">{error}</p>}
      {notice && <p className="rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-500">{notice}</p>}

      {loading ? (
        <div className="flex flex-col gap-5">
          <div className="skeleton h-32 rounded-2xl" />
          <div className="glass-card flex flex-col gap-3 rounded-2xl p-4">
            <div className="skeleton h-4 w-32 rounded-md" />
            <div className="skeleton h-11 rounded-xl" />
            <div className="skeleton h-3 w-48 rounded-md" />
            <div className="skeleton h-11 rounded-xl" />
          </div>
          <div className="glass-card flex flex-col gap-2 rounded-2xl p-4">
            <div className="skeleton mb-1 h-4 w-24 rounded-md" />
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-2.5">
                <span className="skeleton h-8 w-8 shrink-0 rounded-full" />
                <span className="skeleton h-4 flex-1 rounded-md" />
                <span className="skeleton h-4 w-12 shrink-0 rounded-md" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div
            className="flex flex-col items-center gap-1 rounded-2xl p-6 text-center text-white"
            style={{
              background: `linear-gradient(135deg, ${tierInfo.color}, ${tierInfo.color}cc)`,
              boxShadow: `0 12px 28px -10px ${tierInfo.color}99`,
            }}
          >
            <Trophy size={26} />
            <p className="mt-1 text-base font-semibold">{tierInfo.label}</p>
            <p className="text-xs opacity-90">
              {standings.length > 1
                ? 'Top finishers this week promote, bottom finishers demote.'
                : 'Add a friend to start competing for promotion.'}
            </p>
          </div>

          <div className="glass-card flex flex-col gap-3 rounded-2xl p-4">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
              <Users size={15} /> Your friend code
            </h2>
            <div className="flex items-center gap-2">
              <div className="flex-1 rounded-xl bg-black/[0.03] px-3 py-2.5 text-center text-lg font-mono font-semibold tracking-[0.3em] text-gray-900 dark:bg-white/[0.06] dark:text-white">
                {profile?.friendCode ?? '——————'}
              </div>
              <button onClick={handleCopyCode} className="btn-secondary !px-3 !py-2.5">
                <Copy size={15} /> {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <p className="text-xs text-muted">Share this code so a friend can add you — no email needed.</p>

            <div className="mt-1 flex items-center gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Enter a friend's code"
                maxLength={6}
                className="input-field flex-1 font-mono tracking-widest"
              />
              <button
                onClick={handleAddFriend}
                disabled={adding || !code.trim()}
                className="btn-primary !px-3 !py-2.5 text-xs"
              >
                <UserPlus size={15} /> {adding ? 'Adding…' : 'Add'}
              </button>
            </div>
          </div>

          <div className="glass-card flex flex-col gap-2 rounded-2xl p-4">
            <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-white">This week</h2>
            {standings.length <= 1 ? (
              <p className="py-4 text-center text-xs text-muted">
                It's just you so far — add a friend above to see a leaderboard.
              </p>
            ) : (
              standings.map((s, i) => (
                <div
                  key={s.id}
                  className={`flex items-center gap-3 rounded-xl p-2.5 ${
                    s.isSelf ? 'bg-indigo-500/10' : ''
                  }`}
                >
                  <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted">{i + 1}</span>
                  <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full">
                    {s.avatarUrl ? (
                      <img src={s.avatarUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span
                        className="flex h-full w-full items-center justify-center text-[11px] font-semibold text-white"
                        style={{ background: 'linear-gradient(135deg, #2563eb, #4f46e5 60%, #0891b2)' }}
                      >
                        {initials(s.fullName)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-white">
                    {s.isSelf ? 'You' : s.fullName || 'Friend'}
                  </span>
                  <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-indigo-500">
                    <Flame size={12} /> {s.weeklyXp} XP
                  </span>
                  {!s.isSelf && (
                    <button
                      onClick={() => handleRemoveFriend(s.id)}
                      className="shrink-0 text-[10px] text-muted underline"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  )
}
