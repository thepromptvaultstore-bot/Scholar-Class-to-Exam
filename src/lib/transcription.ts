import { supabase } from './supabaseClient'
import { isLimitReachedError, LimitReachedError } from './entitlements'

export async function requestTranscription(
  storagePath: string,
  durationSeconds: number,
): Promise<{ transcript: string; engine: string }> {
  const { data, error } = await supabase.functions.invoke('transcribe-audio', {
    body: { storagePath, durationSeconds },
  })
  if (error) {
    if (await isLimitReachedError(error)) throw new LimitReachedError()
    throw error
  }
  return data
}

export async function requestImageTranscription(
  storagePath: string,
): Promise<{ transcript: string; engine: string }> {
  const { data, error } = await supabase.functions.invoke('transcribe-image', {
    body: { storagePath },
  })
  if (error) {
    if (await isLimitReachedError(error)) throw new LimitReachedError()
    throw error
  }
  return data
}
