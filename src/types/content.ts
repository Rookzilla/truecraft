import type { LucideIcon } from 'lucide-react'

export type Locale = 'en' | 'fr' | 'pl'

export type InfoCard = {
  icon: LucideIcon
  title: string
  copy: string
}

export type IconItem = {
  icon: LucideIcon
  label: string
}

export type TextField = {
  controlId: string
  label: string
  placeholder: string
  type?: 'email' | 'tel' | 'text'
  required?: boolean
  icon?: LucideIcon
  autoComplete?: string
  md?: number
}

export type FormConfig = {
  type: 'business' | 'partnership' | 'candidate'
  title: string
  intro: string
  fields: TextField[]
  commentsLabel: string
  commentsPlaceholder: string
  attachments?: boolean
  attachmentLabel: string
  attachmentCta: string
  attachmentHelp: string
  buttonLabel: string
  success: string
}

export type LanguageCopy = {
  titles: {
    nav: {
      about: string
      businesses: string
      roles: string
      candidates: string
      businessesTop: string
      opportunitiesTop: string
      candidatesTop: string
    }
    hero: {
      title: string
      tagline: string
    }
    about: {
      kicker: string
      quote: string
      promiseKicker: string
      promiseTitle: string
      cards: Array<{
        title: string
        copy: string
      }>
      operationsKicker: string
      operationsTitle: string
      technologyKicker: string
      technologyTitle: string
      experienceKicker: string
      experienceTitle: string
    }
    businesses: {
      kicker: string
      title: string
      contingencyTitle: string
      embeddedTitle: string
      ideal: string
      expect: string
      additional: string
    }
    opportunities: {
      kicker: string
      compactTitleStart: string
      compactTitleEmphasis: string
      browseKicker: string
      browseTitle: string
      promiseTitle: string
      postingsTitle: string
      emptyTitle: string
    }
    resources: {
      kicker: string
      titleOne: string
      titleEmphasis: string
      languageLabel: string
      cvTitle: string
      interviewTitle: string
      supportTitle: string
    }
    forms: {
      businessTitle: string
      partnershipTitle: string
      candidateTitle: string
      fields: {
        business: string
        companyName: string
        name: string
        yourName: string
        jobTitle: string
        yourJobTitle: string
        currentTargetTitle: string
        phone: string
        email: string
        emailAddress: string
      }
    }
    minibar: {
      language: string
      top: string
      nightOn: string
      nightOff: string
    }
  }
  details: {
    hero: {
      text: string
    }
    about: {
      text: string
      promiseText: string
      experienceTextOne: string
      experienceTextTwo: string
    }
    businesses: {
      text: string
      contingencyText: string
      embeddedText: string
      contingencyClose: string
      embeddedClose: string
    }
    opportunities: {
      text: string
      browseText: string
      promiseOne: string
      promiseTwo: string
      postingsText: string
      emptyText: string
    }
    resources: {
      text: string
      intro: string
      cvText: string
      interviewText: string
      supportText: string
    }
    forms: {
      intro: string
      comments: string
      commentsPlaceholder: string
      attachments: string
      attachmentHelp: string
      success: string
    }
  }
  actions: {
    hero: {
      businessCta: string
      candidateCta: string
    }
    opportunities: {
      cvCta: string
    }
    forms: {
      attachmentCta: string
      businessButton: string
      partnershipButton: string
      candidateButton: string
    }
  }
  lists: {
    technologyRoles: string[]
    operationsRoles: string[]
    hiringRealities: string[]
    contingencyIdeal: string[]
    contingencyExpectations: string[]
    embeddedIdeal: string[]
    embeddedExpectations: string[]
    embeddedServices: string[]
    cvSupport: string[]
    interviewSupport: string[]
  }
}
