// Supabase Edge Function: generate-slides
//
// Turns a topic + a subject's notes into a slide deck AND a matching
// presentation script (per-slide speaker notes), generated together in one
// call so the script actually matches what's on each slide — per plan
// section 4.5. The Anthropic API key lives only here, as a function secret.
//
// Deploy:  supabase functions deploy generate-slides
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
//
// Request body: { presentationId: string }
// (the row must already exist with status='generating' — same pattern as
// generate-practice: the client inserts first, RLS covers that insert, this
// function only ever touches its own rows via the service-role key)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const MODEL = 'claude-haiku-4-5'

const SYSTEM_PROMPT = `You build a slide deck and its matching presentation script from a student's class notes and a topic they want to present.
Return ONLY valid JSON matching this exact shape, no prose, no markdown fences:
{
  "title": "deck title",
  "slides": [
    {
      "title": "slide title",
      "bullets": ["short bullet point", "another bullet point"],
      "speaker_notes": "what the presenter should actually say for this slide, in full sentences — matches the bullets, doesn't just repeat them word for word"
    }
  ]
}
Rules:
- 6-12 slides: an intro/title slide, several content slides grounded in the notes, and a closing/summary slide.
- Each content slide: 3-5 short bullets (fragments, not full sentences) plus speaker_notes that expand on them naturally, like a real presenter's script.
- Base the content on the provided notes — do not invent facts that aren't supported by them.`

Deno.serve(async (req) => {
  try {
    const { presentationId } = await req.json()
    if (!presentationId) {
      return new Response(JSON.stringify({ error: 'presentationId is required' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: pres, error: presError } = await supabase
      .from('presentations')
      .select('*')
      .eq('id', presentationId)
      .single()
    if (presError) throw presError

    const { data: notes, error: notesError } = await supabase
      .from('notes')
      .select('title, session_date, content')
      .in('id', pres.note_ids)
    if (notesError) throw notesError

    const material = (notes ?? [])
      .map((n: { title: string; session_date: string; content: string }) =>
        `--- ${n.title} (${n.session_date}) ---\n${n.content}`,
      )
      .join('\n\n')

    if (!material.trim()) {
      throw new Error('The selected note(s) have no content yet — write or record something first.')
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set as a function secret')

    const userPrompt = `Topic: ${pres.topic}\n\nClass notes:\n\n${material}`

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

    const rows = (parsed.slides ?? []).map((s: Record<string, unknown>, i: number) => ({
      presentation_id: presentationId,
      order_index: i,
      title: s.title,
      bullets: s.bullets ?? [],
      speaker_notes: s.speaker_notes ?? '',
    }))
    if (rows.length > 0) {
      const { error: insertError } = await supabase.from('presentation_slides').insert(rows)
      if (insertError) throw insertError
    }

    await supabase
      .from('presentations')
      .update({ topic: parsed.title ?? pres.topic, status: 'ready' })
      .eq('id', presentationId)

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
        .from('presentations')
        .update({ status: 'failed', error: message })
        .eq('id', body.presentationId)
    } catch {
      // best-effort
    }
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
