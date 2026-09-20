import { supabase } from './supabaseClient'

// The read side of course-based note sharing — search/browse notes other
// students opted to publish. The write side (publish/unpublish a note you
// own) lives in lib/data.ts next to the existing shareNote/unshareNote,
// since it's the same "this is my note" write path, just one more field.

export interface CommunityNote {
  id: string
  title: string
  content: string
  sessionDate: string
  courseLabel: string | null
  shareToken: string
  createdAt: string
  university: string | null
  authorName: string
}

const fromRow = (r: Record<string, unknown>): CommunityNote => ({
  id: r.id as string,
  title: r.title as string,
  content: r.content as string,
  sessionDate: r.session_date as string,
  courseLabel: (r.community_course_label as string) ?? null,
  shareToken: r.share_token as string,
  createdAt: r.created_at as string,
  university: (r.university as string) ?? null,
  authorName: r.author_name as string,
})

// Both filters are optional substring matches (case-insensitive), applied
// server-side in the list_community_notes() function — see migration 0017
// for why this goes through a function rather than a direct table select.
export async function browseCommunityNotes(
  courseQuery?: string,
  universityQuery?: string,
): Promise<CommunityNote[]> {
  const { data, error } = await supabase.rpc('list_community_notes', {
    course_query: courseQuery?.trim() || null,
    university_query: universityQuery?.trim() || null,
  })
  if (error) throw error
  return ((data ?? []) as Record<string, unknown>[]).map(fromRow)
}
