import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { buildFormCopy, buildLocalizedContent } from '../data/content'
import { translations } from '../i18n'
import {
  AboutPage,
  BusinessPage,
  CandidatesPage,
  HomePage,
  LegacyOnePage,
  OpportunitiesPage,
} from './HomePage'

const copy = translations.en
const forms = buildFormCopy(copy)
const content = buildLocalizedContent(copy)
const props = {
  businessForm: forms.businessForm,
  candidateForm: forms.candidateForm,
  copy,
  expertiseCards: content.expertiseCards,
  isLanguageMenuOpen: false,
  isNightMode: false,
  lists: content.lists,
  locale: 'en' as const,
  onChangeLocale: vi.fn(),
  onContact: vi.fn(),
  onNavigate: vi.fn(),
  onToggleLanguageMenu: vi.fn(),
  onToggleNightMode: vi.fn(),
  partnershipForm: forms.partnershipForm,
}

describe('page composition', () => {
  it('renders the complete home page flow', () => {
    render(<HomePage {...props} />)

    expect(screen.getByRole('heading', { level: 1, name: copy.titles.hero.title })).toBeInTheDocument()
    expect(screen.getByText('Every business hires differently.')).toBeInTheDocument()
    expect(screen.getByText('Explore our latest vacancies below.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contact / Candidate Enquiry' })).toBeInTheDocument()
  })

  it('renders standalone route pages without the hero', () => {
    const { rerender } = render(<AboutPage {...props} />)
    expect(screen.queryByRole('heading', { level: 1, name: copy.titles.hero.title })).not.toBeInTheDocument()
    expect(screen.getByText(copy.titles.about.kicker)).toBeInTheDocument()

    rerender(<BusinessPage {...props} />)
    expect(screen.getByRole('heading', { name: 'Business enquiry' })).toBeInTheDocument()

    rerender(<OpportunitiesPage {...props} />)
    expect(screen.getByText('Explore our latest vacancies below.')).toBeInTheDocument()

    rerender(<CandidatesPage {...props} />)
    expect(screen.getByRole('heading', { name: 'Contact / Candidate Enquiry' })).toBeInTheDocument()
  })

  it('keeps the legacy single-page composition available', () => {
    render(<LegacyOnePage {...props} />)

    expect(screen.getByText('Every business hires differently.')).toBeInTheDocument()
    expect(screen.getByText('Explore our latest vacancies below.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Contact / Candidate Enquiry' })).toBeInTheDocument()
  })
})
