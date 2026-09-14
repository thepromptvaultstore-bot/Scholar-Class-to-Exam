import { CalendarClock } from 'lucide-react'
import { ComingSoonPage } from './ComingSoonPage'

export default function SchedulePage() {
  return (
    <ComingSoonPage
      icon={CalendarClock}
      title="Timetable & Grades"
      description="Your full class schedule with reminders, plus a GPA calculator matched to your university's grading scale."
      phase="Phase 3 / 6"
    />
  )
}
