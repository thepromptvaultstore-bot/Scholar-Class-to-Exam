// Supabase Edge Function: get-shared
//
// Public, unauthenticated lookup for a shared note or practice set by its
// share_token — the read side of "share a note/practice set via a link"
// (see supabase/migrations/0009_sharing.sql for why this has to be an edge
// function using the service role, rather than an RLS policy the anon key
// could query directly: a policy that just checks "share_token is not
// null" would let anyone list every shared row from every user by omitting
// the token filter, not just fetch the one row they have a link for. This
// function does the exact-token lookup server-side and returns only that
// one sanitized row, with no user_id and nothing about the owner.
//
// For a practice set, the full question rows (including correct_answer /
// rubric) are returned — that's needed so a friend who clicks "Take this
// quiz" can clone the set into their own account and have grade-attempt
// work normally on the clone. Nothing in the client UI renders those
// fields before an attempt is graded, same as the original owner's flow.
//
// Deploy:  supabase functions deploy get-shared
//
// Request body: { token: string, kind: 'note' | 'practice' }
// Response:     { found: false } | { found: true, kind, note?: {...} } | { found: true, kind, practiceSet?: {...}, questions?: [...] }

import { createClient } from 'jsr:@supabase/supabase-js@2'

Deno.serve(async (req) => {
  try {
    const { token, kind } = await req.json()
    if (!token || (kind !== 'note' && kind !== 'practice')) {
      return new Response(JSON.stringify({ error: 'token and a valid kind are required' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    if (kind === 'note') {
      const { data, error } = await supabase
        .from('notes')
        .select('title, session_date, content, capture_mode')
        .eq('share_token', token)
        .maybeSingle()
      if (error) throw error
      if (!data) return new Response(JSON.stringify({ found: false }), { headers: { 'Content-Type': 'application/json' } })
      return new Response(
        JSON.stringify({
          found: true,
          kind: 'note',
          note: {
            title: data.title,
            sessionDate: data.session_date,
            content: data.content,
            captureMode: data.capture_mode,
          },
        }),
        { headers: { 'Content-Type': 'application/json' } },
      )
    }

    const { data: set, error: setError } = await supabase
      .from('practice_sets')
      .select('id, title, format, status')
      .eq('share_token', token)
      .maybeSingle()
    if (setError) throw setError
    if (!set || set.status !== 'ready') {
      return new Response(JSON.stringify({ found: false }), { headers: { 'Content-Type': 'application/json' } })
    }

    const { data: questions, error: qError } = await supabase
      .from('practice_questions')
      .select('order_index, type, prompt, choices, correct_answer, rubric, max_score')
      .eq('practice_set_id', set.id)
      .order('order_index', { ascending: true })
    if (qError) throw qError

    return new Response(
      JSON.stringify({
        found: true,
        kind: 'practice',
        practiceSet: { title: set.title, format: set.format, questionCount: questions.length },
        questions: (questions ?? []).map((q) => ({
          orderIndex: q.order_index,
          type: q.type,
          prompt: q.prompt,
          choices: q.choices ?? null,
          correctAnswer: q.correct_answer ?? null,
          rubric: q.rubric ?? null,
          maxScore: q.max_score,
        })),
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
