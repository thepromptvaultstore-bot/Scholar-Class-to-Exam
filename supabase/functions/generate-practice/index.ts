// Supabase Edge Function: generate-practice
//
// Turns one note, several notes, or a whole subject's notes into a practice
// set — a quiz (objective: MCQ / true-false / fill-in-blank) or an exam-style
// set (short-answer / essay), per plan section 4.2. The Anthropic API key
// lives only here, as a function secret — never in the client bundle.
//
// Also pulls in each selected note's attached "study materials" (images and
// PDFs — a scanned past exam, a textbook chapter, a professor's slide PDF)
// as direct vision/document input to Claude, not just the notes' own text —
// so "practice by making exam questions ... from the notes and study
// materials" (the user's own phrasing) covers both sources in one call.
// Capped to keep the request reasonable; text notes are never capped.
//
// Deploy:  supabase functions deploy generate-practice
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Request body: { practiceSetId: string }
// (the row must already exist with status='generating' — the client creates
// it first via a normal insert, then calls this function to fill it in, so
// RLS covers the insert and this function only ever touches its own rows)

import { createClient } from 'jsr:@supabase/supabase-js@2'
import { checkAndConsume, limitMessage } from '../_shared/entitlements.ts'

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

const MODEL = 'claude-haiku-4-5' // cheap/fast, same choice IELTSGate made for scale
const MAX_MATERIAL_FILES = 8
const MAX_MATERIAL_BYTES = 8 * 1024 * 1024 // 8MB per file, generous for a phone photo/PDF

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  // Captured here (rather than re-reading/cloning `req` in the catch block
  // below) because a Request body can only be consumed once — by the time
  // the catch block ran, `req.clone()` was throwing (the original stream
  // was already read by the `req.json()` below), which silently swallowed
  // every failure and left the row stuck at status='generating' forever.
  let practiceSetId: string | undefined
  try {
    ;({ practiceSetId } = await req.json())
    if (!practiceSetId) {
      return new Response(JSON.stringify({ error: 'practiceSetId is required' }), {
        status: 400,
        headers: corsHeaders,
      })
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

    const entitlement = await checkAndConsume(supabase, set.user_id, 'practice')
    if (!entitlement.allowed) {
      const message = limitMessage('practice')
      await supabase.from('practice_sets').update({ status: 'failed', error: message }).eq('id', practiceSetId)
      return new Response(JSON.stringify({ error: message, code: 'limit_reached' }), {
        status: 402,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

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

    // Attached study materials (images/PDFs) on any of the selected notes —
    // sent to Claude as direct vision/document input alongside the note text.
    const { data: materialRows } = await supabase
      .from('note_materials')
      .select('file_path, file_name, file_type')
      .in('note_id', set.note_ids)

    type MaterialRow = { file_path: string; file_name: string; file_type: string | null }
    const usableMaterials = ((materialRows ?? []) as MaterialRow[])
      .filter((m) => m.file_type?.startsWith('image/') || m.file_type === 'application/pdf')
      .slice(0, MAX_MATERIAL_FILES)

    const materialBlocks: Record<string, unknown>[] = []
    for (const m of usableMaterials) {
      try {
        const { data: file, error: dlError } = await supabase.storage
          .from('note-materials')
          .download(m.file_path)
        if (dlError || !file || file.size > MAX_MATERIAL_BYTES) continue
        const buf = new Uint8Array(await file.arrayBuffer())
        let binary = ''
        const chunk = 0x8000
        for (let i = 0; i < buf.length; i += chunk) binary += String.fromCharCode(...buf.subarray(i, i + chunk))
        const base64 = btoa(binary)
        if (m.file_type === 'application/pdf') {
          materialBlocks.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } })
        } else {
          materialBlocks.push({ type: 'image', source: { type: 'base64', media_type: m.file_type, data: base64 } })
        }
      } catch {
        // A single unreadable attachment shouldn't fail the whole generation.
      }
    }

    if (!material.trim() && materialBlocks.length === 0) {
      throw new Error(
        'The selected note(s) have no content yet — write, record, scan, or attach something first.',
      )
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set as a function secret')

    const textPrompt =
      `Format: ${set.format}\n\nClass notes:\n\n${material || '(no typed/recorded/scanned note text — use the attached study materials below)'}` +
      (materialBlocks.length > 0
        ? `\n\n${materialBlocks.length} attached study material file(s) follow as images/documents — use them as source material too.`
        : '')

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
        messages: [
          { role: 'user', content: [{ type: 'text', text: textPrompt }, ...materialBlocks] },
        ],
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (practiceSetId) {
      try {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL')!,
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
        )
        await supabase
          .from('practice_sets')
          .update({ status: 'failed', error: message })
          .eq('id', practiceSetId)
      } catch {
        // best-effort — if we can't even mark it failed, the client's own
        // fetch-error handling still surfaces the problem.
      }
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
