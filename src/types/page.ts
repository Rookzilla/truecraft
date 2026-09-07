import type { FormConfig, IconItem, InfoCard, LanguageCopy, Locale } from './content'

export type LocalizedLists = {
  technologyRoles: IconItem[]
  operationsRoles: IconItem[]
  hiringRealities: IconItem[]
  contingencyIdeal: IconItem[]
  contingencyExpectations: IconItem[]
  embeddedIdeal: IconItem[]
  embeddedExpectations: IconItem[]
  embeddedServices: IconItem[]
  cvSupport: IconItem[]
  interviewSupport: IconItem[]
}

export type HomePageProps = {
  businessForm: FormConfig
  candidateForm: FormConfig
  copy: LanguageCopy
  expertiseCards: InfoCard[]
  isLanguageMenuOpen: boolean
  isNightMode: boolean
  lists: LocalizedLists
  locale: Locale
  onChangeLocale: (locale: Locale) => void
  onContact: () => void
  onNavigate: (href: string) => void
  onToggleLanguageMenu: () => void
  onToggleNightMode: () => void
  partnershipForm: FormConfig
}
