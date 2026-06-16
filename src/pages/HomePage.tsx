import { AboutSection } from '../components/sections/AboutSection'
import { BusinessSection } from '../components/sections/BusinessSection'
import { CandidateResourcesSection } from '../components/sections/CandidateResourcesSection'
import { OpportunitiesSection } from '../components/sections/OpportunitiesSection'
import { Hero } from '../components/layout/Hero'
import type { HomePageProps } from '../types/page'

export function HomePage({
  copy,
  onContact,
  onNavigate,
}: HomePageProps) {
  return (
    <>
      <Hero copy={copy} onContact={onContact} onNavigate={onNavigate} />
    </>
  )
}

export function AboutPage({ copy, expertiseCards, lists, onContact }: HomePageProps) {
  return (
    <AboutSection
      copy={copy}
      expertiseCards={expertiseCards}
      hiringRealities={lists.hiringRealities}
      onContact={onContact}
      operationsRoles={lists.operationsRoles}
      technologyRoles={lists.technologyRoles}
    />
  )
}

export function BusinessPage({
  businessForm,
  copy,
  lists,
  onContact,
  partnershipForm,
}: HomePageProps) {
  return (
    <BusinessSection
      businessForm={businessForm}
      copy={copy}
      contingencyExpectations={lists.contingencyExpectations}
      contingencyIdeal={lists.contingencyIdeal}
      embeddedExpectations={lists.embeddedExpectations}
      embeddedIdeal={lists.embeddedIdeal}
      embeddedServices={lists.embeddedServices}
      onContact={onContact}
      partnershipForm={partnershipForm}
    />
  )
}

export function OpportunitiesPage({ copy, onContact }: HomePageProps) {
  return <OpportunitiesSection copy={copy} onContact={onContact} />
}

export function CandidatesPage({ candidateForm, copy, lists, onContact }: HomePageProps) {
  return (
    <CandidateResourcesSection
      candidateForm={candidateForm}
      copy={copy}
      cvSupport={lists.cvSupport}
      interviewSupport={lists.interviewSupport}
      onContact={onContact}
    />
  )
}

export function LegacyOnePage({
  businessForm,
  candidateForm,
  copy,
  expertiseCards,
  lists,
  onContact,
  partnershipForm,
}: HomePageProps) {
  return (
    <>
      <AboutSection
        copy={copy}
        expertiseCards={expertiseCards}
        hiringRealities={lists.hiringRealities}
        onContact={onContact}
        operationsRoles={lists.operationsRoles}
        technologyRoles={lists.technologyRoles}
      />
      <BusinessSection
        businessForm={businessForm}
        copy={copy}
        contingencyExpectations={lists.contingencyExpectations}
        contingencyIdeal={lists.contingencyIdeal}
        embeddedExpectations={lists.embeddedExpectations}
        embeddedIdeal={lists.embeddedIdeal}
        embeddedServices={lists.embeddedServices}
        onContact={onContact}
        partnershipForm={partnershipForm}
      />
      <OpportunitiesSection copy={copy} onContact={onContact} />
      <CandidateResourcesSection
        candidateForm={candidateForm}
        copy={copy}
        cvSupport={lists.cvSupport}
        interviewSupport={lists.interviewSupport}
        onContact={onContact}
      />
    </>
  )
}
