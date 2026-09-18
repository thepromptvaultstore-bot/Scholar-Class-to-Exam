import { useEffect, useRef } from 'react'
import { listUpcomingUnnotified, markReminderNotified } from './schedule'

// Best-effort, in-app notification system: while the app is open in a tab,
// this polls for reminders that have come due and haven't fired yet, and
// shows a browser Notification for each. This is not a real push system
// (nothing fires if the app/tab is closed) — see README for why that's a
// deliberate scope decision for this phase.
const POLL_MS = 30_000

export function requestNotificationPermission(): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {})
  }
}

export function useReminderNotifications(userId: string | null | undefined) {
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!userId) return
    if (typeof window === 'undefined' || !('Notification' in window)) return

    let cancelled = false

    async function poll() {
      try {
        const due = await listUpcomingUnnotified()
        if (cancelled) return
        for (const reminder of due) {
          if (Notification.permission === 'granted') {
            new Notification(reminder.title, {
              body: reminder.note || 'Reminder from Scholar',
              tag: reminder.id,
            })
          }
          await markReminderNotified(reminder.id)
        }
      } catch {
        // Silent — a missed poll just gets picked up on the next tick.
      }
    }

    poll()
    timerRef.current = window.setInterval(poll, POLL_MS)
    return () => {
      cancelled = true
      if (timerRef.current) window.clearInterval(timerRef.current)
    }
  }, [userId])
}
