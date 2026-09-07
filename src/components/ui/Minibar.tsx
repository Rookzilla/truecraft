import { ArrowUp, Moon, Sun } from 'lucide-react'
import { LanguageSwitcher } from './LanguageSwitcher'
import type { Locale } from '../../i18n'

export function Minibar({
  isLanguageMenuOpen,
  items,
  isNightMode,
  labels,
  locale,
  onChangeLocale,
  onToggleLanguageMenu,
  onToggleNightMode,
  onNavigate,
}: {
  isLanguageMenuOpen: boolean
  items: Array<{ href: string; label: string }>
  isNightMode: boolean
  labels: {
    language: string
    top: string
    nightOn: string
    nightOff: string
  }
  locale: Locale
  onChangeLocale: (locale: Locale) => void
  onToggleLanguageMenu: () => void
  onToggleNightMode: () => void
  onNavigate: (href: string) => void
}) {
  return (
    <aside className="minibar" aria-label="Page navigation">
      <a
        className="minibar-top"
        href="/"
        aria-label={labels.top}
        onClick={(event) => {
          event.preventDefault()
          onNavigate('/')
        }}
      >
        <ArrowUp size={17} aria-hidden="true" />
      </a>
      <LanguageSwitcher
        isOpen={isLanguageMenuOpen}
        label={labels.language}
        locale={locale}
        onChange={onChangeLocale}
        onToggle={onToggleLanguageMenu}
      />
      <nav className="minibar-nav" aria-label="Section shortcuts">
        {items.map((item) => (
          <a
            href={item.href}
            key={item.href}
            onClick={(event) => {
              event.preventDefault()
              onNavigate(item.href)
            }}
          >
            {item.label}
          </a>
        ))}
      </nav>
      <button
        className="minibar-mode"
        type="button"
        onClick={onToggleNightMode}
        aria-pressed={isNightMode}
        aria-label={isNightMode ? labels.nightOff : labels.nightOn}
      >
        {isNightMode ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
      </button>
    </aside>
  )
}
