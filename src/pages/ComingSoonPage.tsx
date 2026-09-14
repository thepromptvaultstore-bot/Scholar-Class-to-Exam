import type { LucideIcon } from 'lucide-react'

export function ComingSoonPage({
  icon: Icon,
  title,
  description,
  phase,
}: {
  icon: LucideIcon
  title: string
  description: string
  phase: string
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400">
        <Icon size={26} />
      </div>
      <h1 className="text-base font-semibold text-gray-900 dark:text-white">{title}</h1>
      <p className="text-sm text-gray-500">{description}</p>
      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-500 dark:bg-gray-800">
        {phase}
      </span>
    </div>
  )
}
