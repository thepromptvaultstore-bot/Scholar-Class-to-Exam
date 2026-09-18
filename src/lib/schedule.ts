import { supabase } from './supabaseClient'
import type { ClassScheduleEntry, Reminder } from '../types/domain'

const scheduleFromRow = (r: Record<string, unknown>): ClassScheduleEntry => ({
  id: r.id as string,
  subjectId: r.subject_id as string,
  dayOfWeek: r.day_of_week as number,
  startTime: r.start_time as string,
  endTime: r.end_time as string,
  location: (r.location as string) ?? null,
})

const reminderFromRow = (r: Record<string, unknown>): Reminder => ({
  id: r.id as string,
  subjectId: (r.subject_id as string) ?? null,
  title: r.title as string,
  note: (r.note as string) ?? null,
  remindAt: r.remind_at as string,
  notified: r.notified as boolean,
  isDone: r.is_done as boolean,
  createdAt: r.created_at as string,
})

// --- Class schedule (weekly recurring) --------------------------------------

export async function listClassSchedule(): Promise<ClassScheduleEntry[]> {
  const { data, error } = await supabase
    .from('class_schedule')
    .select('*')
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true })
  if (error) throw error
  return (data ?? []).map(scheduleFromRow)
}

export async function createClassScheduleEntry(
  userId: string,
  subjectId: string,
  dayOfWeek: number,
  startTime: string,
  endTime: string,
  location?: string,
): Promise<ClassScheduleEntry> {
  const { data, error } = await supabase
    .from('class_schedule')
    .insert({
      user_id: userId,
      subject_id: subjectId,
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      location: location || null,
    })
    .select()
    .single()
  if (error) throw error
  return scheduleFromRow(data)
}

export async function deleteClassScheduleEntry(id: string): Promise<void> {
  const { error } = await supabase.from('class_schedule').delete().eq('id', id)
  if (error) throw error
}

// --- Reminders ----------------------------------------------------------------

export async function listReminders(): Promise<Reminder[]> {
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .order('remind_at', { ascending: true })
  if (error) throw error
  return (data ?? []).map(reminderFromRow)
}

export async function listUpcomingUnnotified(): Promise<Reminder[]> {
  // Anything due within the next 60 seconds (or overdue) that hasn't fired
  // yet and isn't marked done — polled client-side while the app is open.
  const cutoff = new Date(Date.now() + 60_000).toISOString()
  const { data, error } = await supabase
    .from('reminders')
    .select('*')
    .eq('notified', false)
    .eq('is_done', false)
    .lte('remind_at', cutoff)
  if (error) throw error
  return (data ?? []).map(reminderFromRow)
}

export async function createReminder(
  userId: string,
  title: string,
  remindAt: string,
  subjectId?: string | null,
  note?: string,
): Promise<Reminder> {
  const { data, error } = await supabase
    .from('reminders')
    .insert({
      user_id: userId,
      title,
      remind_at: remindAt,
      subject_id: subjectId || null,
      note: note || null,
    })
    .select()
    .single()
  if (error) throw error
  return reminderFromRow(data)
}

export async function markReminderNotified(id: string): Promise<void> {
  const { error } = await supabase.from('reminders').update({ notified: true }).eq('id', id)
  if (error) throw error
}

export async function toggleReminderDone(id: string, isDone: boolean): Promise<void> {
  const { error } = await supabase.from('reminders').update({ is_done: isDone }).eq('id', id)
  if (error) throw error
}

export async function deleteReminder(id: string): Promise<void> {
  const { error } = await supabase.from('reminders').delete().eq('id', id)
  if (error) throw error
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
