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

Deno.serve(async (req) => {
  try {
    const { userId, code } = await req.json()
    if (!userId || !code || typeof code !== 'string') {
      return new Response(JSON.stringify({ error: 'userId and code are required' }), { status: 400 })
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
      return new Response(JSON.stringify({ error: "No Scholar user has that friend code." }), { status: 404 })
    }
    if (friend.id === userId) {
      return new Response(JSON.stringify({ error: "That's your own friend code." }), { status: 400 })
    }

    const { data: existing, error: existingError } = await supabase
      .from('friendships')
      .select('id')
      .eq('user_id', userId)
      .eq('friend_id', friend.id)
      .maybeSingle()
    if (existingError) throw existingError
    if (existing) {
      return new Response(JSON.stringify({ error: 'You are already friends.' }), { status: 409 })
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
      { headers: { 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})

