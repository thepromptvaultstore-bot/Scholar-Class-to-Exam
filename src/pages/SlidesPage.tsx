import { Presentation } from 'lucide-react'
import { ComingSoonPage } from './ComingSoonPage'

export default function SlidesPage() {
  return (
    <ComingSoonPage
      icon={Presentation}
      title="Slides & Presentation"
      description="Turn a topic and your notes into a slide deck plus a matching presentation script."
      phase="Phase 5"
    />
  )
}
