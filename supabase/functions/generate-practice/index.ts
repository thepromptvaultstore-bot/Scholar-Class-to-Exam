// Supabase Edge Function: generate-practice
//
// Turns one note, several notes, or a whole subject's notes into a practice
// set — a quiz (objective: MCQ / true-false / fill-in-blank) or an exam-style
// set (short-answer / essay), per plan section 4.2. The Anthropic API key
// lives only here, as a function secret — never in the client bundle.
//
// Deploy:  supabase functions deploy generate-practice
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Request body: { practiceSetId: string }
// (the row must already exist with status='generating' — the client creates
// it first via a normal insert, then calls this function to fill it in, so
// RLS covers the insert and this function only ever touches its own rows)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = 'claude-haiku-4-5' // cheap/fast, same choice IELTSGate made for scale

const SYSTEM_PROMPT = `You write practice questions for a university student from their own class notes.
Return ONLY valid JSON matching this exact shape, no prose, no markdown fences:
{
  "title": "short descriptive title",
  "questions": [
    {
      "type": "mcq" | "true_false" | "fill_blank" | "short_answer" | "essay",
      "prompt": "the question text",
      "choices": ["A", "B", "C", "D"]        // only for type "mcq", omit otherwise
      "correct_answer": "the exact correct choice or short answer",  // only for mcq/true_false/fill_blank
      "rubric": "grading criteria: what a full-credit answer must cover", // only for short_answer/essay
      "max_score": 1                          // 1 for objective types, 4-10 for short_answer/essay
    }
  ]
}
Quiz format = objective only (mcq, true_false, fill_blank), 6-10 questions.
Exam format = topic-based only (short_answer, essay), 3-6 questions that require explaining the material in the student's own words, matching how a real midterm/final would ask it.`

Deno.serve(async (req) => {
  try {
    const { practiceSetId } = await req.json()
    if (!practiceSetId) {
      return new Response(JSON.stringify({ error: 'practiceSetId is required' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: set, error: setError } = await supabase
      .from('practice_sets')
      .select('*')
      .eq('id', practiceSetId)
      .single()
    if (setError) throw setError

    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('title, session_date, content')
      .in('id', set.note_ids)
    if (notesError) throw notesError

    const material = notes
      .map((n: { title: string; session_date: string; content: string }) =>
        `--- ${n.title} (${n.session_date}) ---\n${n.content}`,
      )
      .join('\n\n')

    if (!material.trim()) {
      throw new Error('The selected note(s) have no content yet — write or record something first.')
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set as a function secret')

    const userPrompt = `Format: ${set.format}\n\nClass notes:\n\n${material}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)
    const json = await res.json()
    const text = json.content?.[0]?.text ?? '{}'
    const parsed = JSON.parse(text)

    await supabase
      .from('practice_sets')
      .update({ title: parsed.title ?? set.title, status: 'ready' })
      .eq('id', practiceSetId)

    const rows = (parsed.questions ?? []).map((q: Record<string, unknown>, i: number) => ({
      practice_set_id: practiceSetId,
      order_index: i,
      type: q.type,
      prompt: q.prompt,
      choices: q.choices ?? null,
      correct_answer: q.correct_answer ?? null,
      rubric: q.rubric ?? null,
      max_score: q.max_score ?? 1,
    }))
    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('practice_questions').insert(rows)
      if (insertError) throw insertError
    }

    return new Response(JSON.stringify({ ok: true, count: rows.length }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    try {
      const body = await req.clone().json()
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      )
      await supabase
        .from('practice_sets')
        .update({ status: 'failed', error: message })
        .eq('id', body.practiceSetId)
    } catch {
      // best-effort — if we can't even mark it failed, the client's own
      // fetch-error handling still surfaces the problem.
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
