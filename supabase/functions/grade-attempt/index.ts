// Supabase Edge Function: grade-attempt
//
// Grades a completed practice attempt against a real academic standard
// (plan section 4.2): objective questions (mcq/true_false/fill_blank) are
// checked directly; short_answer/essay questions are graded against the
// rubric generate-practice produced, with partial credit — not keyword
// matching — the same way a professor would mark them. This is what lets
// the score mean something once it feeds the knowledge-score and grade
// calculator in later phases.
//
// Deploy:  supabase functions deploy grade-attempt
// Secret:  reuses ANTHROPIC_API_KEY (see generate-practice)
//
// Request body: { attemptId: string }

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = 'claude-haiku-4-5'

const GRADING_SYSTEM_PROMPT = `You are grading a university student's short-answer/essay response the way a fair professor would: partial credit for a partially correct or incomplete answer, full credit only when the rubric's criteria are genuinely met.
Return ONLY valid JSON, no prose, no markdown fences:
{ "score": <number, 0 to max_score, may be fractional>, "feedback": "one or two sentences on what was right/missing" }`

function normalize(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

Deno.serve(async (req) => {
  try {
    const { attemptId } = await req.json()
    if (!attemptId) {
      return new Response(JSON.stringify({ error: 'attemptId is required' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { error: attemptError } = await supabase
      .from('practice_attempts')
      .select('id')
      .eq('id', attemptId)
      .single()
    if (attemptError) throw attemptError

    await supabase.from('practice_attempts').update({ status: 'grading' }).eq('id', attemptId)

    const { data: answers, error: answersError } = await supabase
      .from('practice_answers')
      .select('*, practice_questions(*)')
      .eq('attempt_id', attemptId)
    if (answersError) throw answersError

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')

    let earned = 0
    let possible = 0

    for (const answer of answers) {
      const q = answer.practice_questions as {
        type: string
        prompt: string
        correct_answer: string | null
        rubric: string | null
        max_score: number
      }
      possible += q.max_score

      if (q.type === 'mcq' || q.type === 'true_false' || q.type === 'fill_blank') {
        const isCorrect = normalize(answer.user_answer) === normalize(q.correct_answer ?? '')
        const score = isCorrect ? q.max_score : 0
        earned += score
        await supabase
          .from('practice_answers')
          .update({ score, is_correct: isCorrect, feedback: isCorrect ? 'Correct.' : `Correct answer: ${q.correct_answer}` })
          .eq('id', answer.id)
        continue
      }

      // short_answer / essay — rubric-graded via Claude, with partial credit.
      if (!apiKey || !answer.user_answer.trim()) {
        // No key configured, or blank answer: 0 credit, explicit reason (not
        // a silent guess) so it's never mistaken for a real grade.
        await supabase
          .from('practice_answers')
          .update({
            score: 0,
            is_correct: false,
            feedback: !answer.user_answer.trim()
              ? 'No answer submitted.'
              : 'Grading unavailable (ANTHROPIC_API_KEY not configured).',
          })
          .eq('id', answer.id)
        continue
      }

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: MODEL,
          max_tokens: 512,
          system: GRADING_SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Question: ${q.prompt}\nRubric (max score ${q.max_score}): ${q.rubric}\n\nStudent's answer:\n${answer.user_answer}`,
            },
          ],
        }),
      })
      if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)
      const json = await res.json()
      const parsed = JSON.parse(json.content?.[0]?.text ?? '{}')
      const score = Math.max(0, Math.min(q.max_score, Number(parsed.score) || 0))
      earned += score
      await supabase
        .from('practice_answers')
        .update({ score, is_correct: score >= q.max_score, feedback: parsed.feedback ?? null })
        .eq('id', answer.id)
    }

    const totalScore = possible > 0 ? Math.round((earned / possible) * 1000) / 10 : 0

    await supabase
      .from('practice_attempts')
      .update({ status: 'graded', total_score: totalScore, completed_at: new Date().toISOString() })
      .eq('id', attemptId)

    return new Response(JSON.stringify({ totalScore }), {
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
      await supabase.from('practice_attempts').update({ status: 'failed' }).eq('id', body.attemptId)
    } catch {
      // best-effort
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
