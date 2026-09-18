import { supabase } from './supabaseClient'
import type { Presentation, PresentationStatus, Slide } from '../types/slides'

const presentationFromRow = (r: Record<string, unknown>): Presentation => ({
  id: r.id as string,
  subjectId: r.subject_id as string,
  noteIds: (r.note_ids as string[]) ?? [],
  topic: r.topic as string,
  status: r.status as PresentationStatus,
  error: (r.error as string) ?? null,
  createdAt: r.created_at as string,
})

const slideFromRow = (r: Record<string, unknown>): Slide => ({
  id: r.id as string,
  presentationId: r.presentation_id as string,
  orderIndex: r.order_index as number,
  title: r.title as string,
  bullets: (r.bullets as string[]) ?? [],
  speakerNotes: (r.speaker_notes as string) ?? '',
})

export async function listPresentations(subjectId?: string): Promise<Presentation[]> {
  let query = supabase.from('presentations').select('*').order('created_at', { ascending: false })
  if (subjectId) query = query.eq('subject_id', subjectId)
  const { data, error } = await query
  if (error) throw error
  return (data ?? []).map(presentationFromRow)
}

export async function createPresentation(
  userId: string,
  subjectId: string,
  noteIds: string[],
  topic: string,
): Promise<Presentation> {
  const { data, error } = await supabase
    .from('presentations')
    .insert({
      user_id: userId,
      subject_id: subjectId,
      note_ids: noteIds,
      topic,
      status: 'generating',
    })
    .select()
    .single()
  if (error) throw error

  const presentation = presentationFromRow(data)

  const { error: fnError } = await supabase.functions.invoke('generate-slides', {
    body: { presentationId: presentation.id },
  })
  if (fnError) throw fnError

  return presentation
}

export async function getPresentation(id: string): Promise<Presentation> {
  const { data, error } = await supabase.from('presentations').select('*').eq('id', id).single()
  if (error) throw error
  return presentationFromRow(data)
}

export async function listSlides(presentationId: string): Promise<Slide[]> {
  const { data, error } = await supabase
    .from('presentation_slides')
    .select('*')
    .eq('presentation_id', presentationId)
    .order('order_index', { ascending: true })
  if (error) throw error
  return (data ?? []).map(slideFromRow)
}

export async function deletePresentation(id: string): Promise<void> {
  const { error } = await supabase.from('presentations').delete().eq('id', id)
  if (error) throw error
}
