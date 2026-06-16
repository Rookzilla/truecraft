import type { LucideIcon } from 'lucide-react'
import { AnimatedCard } from '../../ui/AnimatedCard'
import { IconGrid, TextBulletList } from '../../ui/IconLists'
import type { IconItem } from '../../../types/content'

export function ServiceCard({
  additionalLabel,
  close,
  expectationItems,
  expectLabel,
  icon: Icon,
  idealItems,
  idealLabel,
  additionalItems,
  intro,
  title,
}: {
  additionalLabel?: string
  close: string
  expectationItems: IconItem[]
  expectLabel: string
  icon: LucideIcon
  idealItems: IconItem[]
  idealLabel: string
  additionalItems?: IconItem[]
  intro: string
  title: string
}) {
  return (
    <AnimatedCard className="service-panel">
      <span className="card-icon">
        <Icon size={24} aria-hidden="true" />
      </span>
      <h3>{title}</h3>
      <p>{intro}</p>
      <h4>{idealLabel}</h4>
      <IconGrid items={idealItems} variant="dark" />
      <h4>{expectLabel}</h4>
      <TextBulletList items={expectationItems} />
      {additionalItems && additionalLabel ? (
        <>
          <h4>{additionalLabel}</h4>
          <TextBulletList items={additionalItems} />
        </>
      ) : null}
      <p className="service-close">{close}</p>
    </AnimatedCard>
  )
}
