import type { LucideIcon } from 'lucide-react'
import { AnimatedCard } from './AnimatedCard'
import { IconGrid } from './IconLists'
import type { IconItem } from '../../types/content'

export function FeatureCard({
  copy,
  icon: Icon,
  items,
  title,
}: {
  copy: string
  icon: LucideIcon
  items: IconItem[]
  title: string
}) {
  return (
    <AnimatedCard className="feature-card">
      <span className="card-icon">
        <Icon size={24} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{copy}</p>
      <IconGrid items={items} />
    </AnimatedCard>
  )
}
