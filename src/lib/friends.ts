import { supabase } from './supabaseClient'
import type { Friend } from '../types/gamification'

export interface FriendsBoard {
  friends: Friend[]
  self: { weeklyXp: number; totalXp: number }
  weekStart: string
}

// weeksAgo: 0 = this week (for rendering the board), 1 = last week (for
// deciding promotion/demotion at a weekly rollover).
export async function fetchFriendsBoard(userId: string, weeksAgo = 0): Promise<FriendsBoard> {
  const { data, error } = await supabase.functions.invoke('get-friends', {
    body: { userId, weeksAgo },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data as FriendsBoard
}

export async function addFriendByCode(
  userId: string,
  code: string,
): Promise<{ id: string; fullName: string | null; avatarUrl: string | null }> {
  const { data, error } = await supabase.functions.invoke('add-friend', {
    body: { userId, code },
  })
  if (error) throw error
  if (data?.error) throw new Error(data.error)
  return data.friend
}

// Removes the caller's own side of the friendship. The friend's reverse row
// (written when they were added) is theirs per RLS, so this is a one-sided
// "unfriend" rather than requiring their consent — low-stakes enough that a
// service-role round trip to clean up both sides isn't worth it.
export async function removeFriend(userId: string, friendId: string): Promise<void> {
  const { error } = await supabase.from('friendships').delete().eq('user_id', userId).eq('friend_id', friendId)
  if (error) throw error
}

