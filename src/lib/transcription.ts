import { supabase } from './supabaseClient'

export async function requestTranscription(
  storagePath: string,
): Promise<{ transcript: string; engine: string }> {
  const { data, error } = await supabase.functions.invoke('transcribe-audio', {
    body: { storagePath },
  })
  if (error) throw error
  return data
}
