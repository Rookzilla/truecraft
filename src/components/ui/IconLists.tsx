import type { IconItem } from '../../types/content'

export function IconGrid({ items, variant = 'light' }: { items: IconItem[]; variant?: 'light' | 'dark' | 'compact' }) {
  return (
    <ul className={`icon-grid icon-grid-${variant}`}>
      {items.map(({ icon: Icon, label }) => (
        <li key={label}>
          <span>
            <Icon size={18} aria-hidden="true" />
          </span>
          {label}
        </li>
      ))}
    </ul>
  )
}

export function TextBulletList({ items }: { items: IconItem[] }) {
  return (
    <ul className="text-bullet-list">
      {items.map(({ label }) => (
        <li key={label}>{label}</li>
      ))}
    </ul>
  )
}
