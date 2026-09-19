// Supabase Edge Function: transcribe-image
//
// OCRs a photo of a handwritten (or printed) notes page into clean text,
// using Claude's vision input — no separate OCR API/key needed, since
// ANTHROPIC_API_KEY is already a function secret for generate-practice /
// generate-slides / grade-attempt. This is what makes "scan a handwritten
// page" behave just like "record the lecture": the client uploads the
// photo, calls this function, and merges the returned text into the note's
// `content`, so scanned notes end up in the exact same place typed and
// voice-transcribed notes do.
//
// Deploy:  supabase functions deploy transcribe-image
// (uses the same ANTHROPIC_API_KEY secret as the other AI functions)
//
// Request body: { storagePath: string }  (a path inside the 'note-materials' bucket)
// Response:     { transcript: string, engine: 'claude-vision' }

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

const MODEL = 'claude-haiku-4-5'

const SYSTEM_PROMPT = `You transcribe a photo of a student's notes page (handwritten or printed) into clean text.
Rules:
- Output ONLY the transcribed content — no preamble, no "Here is the transcription", no markdown code fences.
- Preserve structure: headings, bullet points, numbered lists, and paragraph breaks should come through as plain text/markdown (e.g. "- " for bullets, "# " for a clear heading).
- Preserve diagrams, tables, and math as best you can in plain text (e.g. simple ASCII for a labeled diagram, "x^2" for exponents) rather than skipping them — add a short bracketed note like "[diagram: ...]" only if something truly can't be rendered as text.
- Fix obvious spelling slips but never change the meaning or invent content that isn't legible — if a word is genuinely illegible, write "[illegible]" rather than guessing.
- If the image contains no readable notes content at all, return exactly: [No readable text found in this image.]`

function guessMediaType(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  if (ext === 'png') return 'image/png'
  if (ext === 'webp') return 'image/webp'
  if (ext === 'gif') return 'image/gif'
  return 'image/jpeg'
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < buf.length; i += chunk) {
    binary += String.fromCharCode(...buf.subarray(i, i + chunk))
  }
  return btoa(binary)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  try {
    const { storagePath } = await req.json()
    if (!storagePath) {
      return new Response(JSON.stringify({ error: 'storagePath is required' }), {
        status: 400,
        headers: corsHeaders,
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: file, error: downloadError } = await supabase.storage
      .from('note-materials')
      .download(storagePath)
    if (downloadError) throw downloadError

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set as a function secret')

    const base64 = await blobToBase64(file)
    const mediaType = guessMediaType(storagePath)

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
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
              { type: 'text', text: 'Transcribe this notes page.' },
            ],
          },
        ],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic API error ${res.status}: ${await res.text()}`)
    const json = await res.json()
    const transcript = json.content?.[0]?.text?.trim() ?? ''

    return new Response(JSON.stringify({ transcript, engine: 'claude-vision' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
