import { FR, GB, PL, US } from 'country-flag-icons/react/3x2'
import { languageOptions, type Locale } from '../../i18n'

const flagComponents = {
  FR,
  GB,
  PL,
  US,
}

function FlagGroup({ countries, label }: { countries: string[]; label: string }) {
  return (
    <span className="language-flags" aria-hidden="true">
      {countries.map((countryCode) => {
        const Flag = flagComponents[countryCode as keyof typeof flagComponents]
        return <Flag className="language-flag" key={`${label}-${countryCode}`} title={countryCode} />
      })}
    </span>
  )
}

export function LanguageSwitcher({
  isOpen,
  locale,
  onChange,
  onToggle,
  label,
}: {
  isOpen: boolean
  locale: Locale
  onChange: (locale: Locale) => void
  onToggle: () => void
  label: string
}) {
  const activeLanguage = languageOptions.find((option) => option.locale === locale) ?? languageOptions[0]
  const inactiveLanguages = languageOptions.filter((option) => option.locale !== locale)

  return (
    <div className="language-switcher">
      <span className="language-label">{label}</span>
      <button
        className="language-trigger"
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="language-current">
          <FlagGroup countries={activeLanguage.countries} label={activeLanguage.label} />
          <strong>{activeLanguage.label}</strong>
        </span>
      </button>
      <div className={isOpen ? 'language-menu is-open' : 'language-menu'}>
        {inactiveLanguages.map((option) => (
          <button
            key={option.locale}
            type="button"
            onClick={() => {
            onChange(option.locale)
            }}
          >
            <span className="language-option">
              <FlagGroup countries={option.countries} label={option.label} />
              <span>{option.label}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
