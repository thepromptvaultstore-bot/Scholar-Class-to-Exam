// Supabase Edge Function: get-friends
//
// Returns the caller's friends (with this-week and lifetime XP) plus the
// caller's own weekly XP for the same window, for rendering/rolling over
// the friends-only weekly league. This has to be an edge function because
// "profiles: read own" RLS blocks reading anyone else's profile row
// directly, and xp_events RLS likewise only exposes the caller's own
// events — a service-role lookup is the only way to compute a leaderboard
// across multiple users. The week boundary (Monday 00:00 UTC) is computed
// here, not on the client, so everyone in a league agrees on what a given
// week means; `weeksAgo` lets the client ask about last week (to decide
// promotion/demotion) as well as the current one (to render the board).
//
// Deploy:  supabase functions deploy get-friends
//
// Request body: { userId: string, weeksAgo?: number }
// Response:     {
//   friends: [{ id, fullName, avatarUrl, weeklyXp, totalXp }],
//   self: { weeklyXp, totalXp },
//   weekStart: string,
// }

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

function mondayOfWeekUTC(weeksAgo: number): { start: string; end: string } {
  const now = new Date()
  const day = now.getUTCDay() // 0 = Sunday .. 6 = Saturday
  const diffToMonday = (day + 6) % 7
  const thisMonday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - diffToMonday))
  const start = new Date(thisMonday)
  start.setUTCDate(start.getUTCDate() - weeksAgo * 7)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 7)
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { userId, weeksAgo } = await req.json()
    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }
    const offset = typeof weeksAgo === 'number' && weeksAgo >= 0 ? weeksAgo : 0

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { start: weekStart, end: weekEnd } = mondayOfWeekUTC(offset)

    const { data: links, error: linksError } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', userId)
    if (linksError) throw linksError

    const friendIds = (links ?? []).map((l: { friend_id: string }) => l.friend_id)
    const allIds = [userId, ...friendIds]

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', friendIds.length > 0 ? friendIds : ['00000000-0000-0000-0000-000000000000'])
    if (profilesError) throw profilesError

    const { data: events, error: eventsError } = await supabase
      .from('xp_events')
      .select('user_id, amount, created_at')
      .in('user_id', allIds)
    if (eventsError) throw eventsError

    const totals = new Map<string, number>()
    const weekly = new Map<string, number>()
    for (const e of events ?? []) {
      const amount = e.amount ?? 0
      totals.set(e.user_id, (totals.get(e.user_id) ?? 0) + amount)
      const d = e.created_at.slice(0, 10)
      if (d >= weekStart && d < weekEnd) {
        weekly.set(e.user_id, (weekly.get(e.user_id) ?? 0) + amount)
      }
    }

    const friends = (profiles ?? []).map((p: { id: string; full_name: string | null; avatar_url: string | null }) => ({
      id: p.id,
      fullName: p.full_name,
      avatarUrl: p.avatar_url,
      weeklyXp: weekly.get(p.id) ?? 0,
      totalXp: totals.get(p.id) ?? 0,
    }))

    return new Response(
      JSON.stringify({
        friends,
        self: { weeklyXp: weekly.get(userId) ?? 0, totalXp: totals.get(userId) ?? 0 },
        weekStart,
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
