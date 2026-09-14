// Supabase Edge Function: transcribe-audio
//
// Deliberately engine-agnostic. The product plan (section 2.3) leaves the
// transcription engine as an open decision pending a head-to-head test
// against real lecture audio (Deepgram Nova-3 / GPT-4o Transcribe /
// AssemblyAI Universal-2 / ElevenLabs Scribe). Rather than block the rest of
// the app on that test, this function reads TRANSCRIPTION_ENGINE from its
// own environment and dispatches to whichever adapter is configured — so
// swapping engines later, or running the head-to-head test itself, is a
// config change here, not a rewrite of the client app.
//
// Deploy with: supabase functions deploy transcribe-audio
// Secrets:     supabase secrets set TRANSCRIPTION_ENGINE=deepgram DEEPGRAM_API_KEY=...
//
// Request body: { storagePath: string }  (a path inside the 'lecture-audio' bucket)
// Response:     { transcript: string, engine: string }

import { createClient } from 'jsr:@supabase/supabase-js@2'

const ENGINE = Deno.env.get('TRANSCRIPTION_ENGINE') ?? 'none'

type Adapter = (audio: Blob) => Promise<string>

const adapters: Record<string, Adapter> = {
  // --- Deepgram Nova-3 --------------------------------------------------
  async deepgram(audio) {
    const key = Deno.env.get('DEEPGRAM_API_KEY')
    if (!key) throw new Error('DEEPGRAM_API_KEY not set')
    const res = await fetch(
      'https://api.deepgram.com/v1/listen?model=nova-3&smart_format=true&punctuate=true',
      {
        method: 'POST',
        headers: { Authorization: `Token ${key}`, 'Content-Type': audio.type || 'audio/webm' },
        body: audio,
      },
    )
    if (!res.ok) throw new Error(`Deepgram error ${res.status}: ${await res.text()}`)
    const json = await res.json()
    return json.results?.channels?.[0]?.alternatives?.[0]?.transcript ?? ''
  },

  // --- OpenAI GPT-4o Transcribe -----------------------------------------
  async openai(audio) {
    const key = Deno.env.get('OPENAI_API_KEY')
    if (!key) throw new Error('OPENAI_API_KEY not set')
    const form = new FormData()
    form.append('file', audio, 'lecture.webm')
    form.append('model', 'gpt-4o-transcribe')
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
    })
    if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${await res.text()}`)
    const json = await res.json()
    return json.text ?? ''
  },

  // --- AssemblyAI Universal-2 --------------------------------------------
  async assemblyai(audio) {
    const key = Deno.env.get('ASSEMBLYAI_API_KEY')
    if (!key) throw new Error('ASSEMBLYAI_API_KEY not set')
    const uploadRes = await fetch('https://api.assemblyai.com/v2/upload', {
      method: 'POST',
      headers: { authorization: key },
      body: audio,
    })
    if (!uploadRes.ok) throw new Error(`AssemblyAI upload error ${uploadRes.status}`)
    const { upload_url } = await uploadRes.json()
    const transcriptRes = await fetch('https://api.assemblyai.com/v2/transcript', {
      method: 'POST',
      headers: { authorization: key, 'content-type': 'application/json' },
      body: JSON.stringify({ audio_url: upload_url, speech_model: 'universal-2' }),
    })
    const { id } = await transcriptRes.json()
    // Poll until done (edge functions have a request time limit — fine for
    // short class-clip chunks, but long lectures should be chunked client-side).
    for (let i = 0; i < 60; i++) {
      await new Promise((r) => setTimeout(r, 3000))
      const poll = await fetch(`https://api.assemblyai.com/v2/transcript/${id}`, {
        headers: { authorization: key },
      })
      const json = await poll.json()
      if (json.status === 'completed') return json.text ?? ''
      if (json.status === 'error') throw new Error(`AssemblyAI error: ${json.error}`)
    }
    throw new Error('AssemblyAI transcription timed out')
  },

  // --- ElevenLabs Scribe ---------------------------------------------------
  async elevenlabs(audio) {
    const key = Deno.env.get('ELEVENLABS_API_KEY')
    if (!key) throw new Error('ELEVENLABS_API_KEY not set')
    const form = new FormData()
    form.append('file', audio, 'lecture.webm')
    form.append('model_id', 'scribe_v1')
    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': key },
      body: form,
    })
    if (!res.ok) throw new Error(`ElevenLabs error ${res.status}: ${await res.text()}`)
    const json = await res.json()
    return json.text ?? ''
  },

  // --- No engine configured yet -------------------------------------------
  async none() {
    return (
      '[No transcription engine configured yet. Set TRANSCRIPTION_ENGINE and the ' +
      "matching API key as Supabase function secrets once the head-to-head test " +
      "(section 2.3 of the plan) picks a winner. This note was captured by voice " +
      'and is waiting on that.]'
    )
  },
}

Deno.serve(async (req) => {
  try {
    const { storagePath } = await req.json()
    if (!storagePath) {
      return new Response(JSON.stringify({ error: 'storagePath is required' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: file, error: downloadError } = await supabase.storage
      .from('lecture-audio')
      .download(storagePath)
    if (downloadError) throw downloadError

    const adapter = adapters[ENGINE] ?? adapters.none
    const transcript = await adapter(file)

    return new Response(JSON.stringify({ transcript, engine: ENGINE }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
