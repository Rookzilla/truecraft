import { CheckCircle2, type LucideIcon } from 'lucide-react'
import type { IconItem, InfoCard, LanguageCopy } from '../types/content'
import { cardIcons, roleIcons } from './contentIcons'

function withIcons(labels: string[], icons: LucideIcon[]): IconItem[] {
  return labels.map((label, index) => ({
    icon: icons[index] ?? CheckCircle2,
    label,
  }))
}

export function buildLocalizedContent(copy: LanguageCopy) {
  const expertiseCards: InfoCard[] = [
    { icon: cardIcons.expertise, title: copy.titles.about.cards[0].title, copy: copy.titles.about.cards[0].copy },
    { icon: cardIcons.technology, title: copy.titles.about.cards[1].title, copy: copy.titles.about.cards[1].copy },
    { icon: cardIcons.operations, title: copy.titles.about.cards[2].title, copy: copy.titles.about.cards[2].copy },
  ]

  return {
    expertiseCards,
    lists: {
      technologyRoles: withIcons(copy.lists.technologyRoles, roleIcons.technology),
      operationsRoles: withIcons(copy.lists.operationsRoles, roleIcons.operations),
      hiringRealities: withIcons(copy.lists.hiringRealities, roleIcons.realities),
      contingencyIdeal: withIcons(copy.lists.contingencyIdeal, roleIcons.contingencyIdeal),
      contingencyExpectations: withIcons(copy.lists.contingencyExpectations, roleIcons.contingencyExpectations),
      embeddedIdeal: withIcons(copy.lists.embeddedIdeal, roleIcons.embeddedIdeal),
      embeddedExpectations: withIcons(copy.lists.embeddedExpectations, roleIcons.embeddedExpectations),
      embeddedServices: withIcons(copy.lists.embeddedServices, roleIcons.embeddedServices),
      cvSupport: withIcons(copy.lists.cvSupport, roleIcons.cvSupport),
      interviewSupport: withIcons(copy.lists.interviewSupport, roleIcons.interviewSupport),
    },
  }
}
