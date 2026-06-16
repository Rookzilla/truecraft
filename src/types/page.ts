import type { FormConfig, IconItem, InfoCard, LanguageCopy } from './content'

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
  lists: LocalizedLists
  onContact: () => void
  onNavigate: (href: string) => void
  partnershipForm: FormConfig
}
