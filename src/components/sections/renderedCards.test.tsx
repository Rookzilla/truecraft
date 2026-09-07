import { BriefcaseBusiness, Hammer } from 'lucide-react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { translations } from '../../i18n'
import { ExpertiseCards } from './about/ExpertiseCards'
import { RolePanels } from './about/RolePanels'
import { OpportunityIntroCard } from './opportunities/OpportunityIntroCard'

describe('section card components', () => {
  it('renders expertise cards with supplied icons and copy', () => {
    render(
      <ExpertiseCards
        cards={[
          { icon: Hammer, title: 'Delivery', copy: 'Hands-on platform delivery.' },
          { icon: BriefcaseBusiness, title: 'Operations', copy: 'Business process support.' },
        ]}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Delivery' })).toBeInTheDocument()
    expect(screen.getByText('Hands-on platform delivery.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Operations' })).toBeInTheDocument()
    expect(screen.getByText('Business process support.')).toBeInTheDocument()
  })

  it('runs the opportunities CV callback when provided', async () => {
    const user = userEvent.setup()
    const onContact = vi.fn()

    render(<OpportunityIntroCard copy={translations.en} onContact={onContact} />)

    await user.click(screen.getByRole('button', { name: /Send your CV/i }))

    expect(onContact).toHaveBeenCalled()
  })

  it('leaves the CV link as a normal anchor without an override callback', () => {
    render(<OpportunityIntroCard copy={translations.en} />)

    const link = screen.getByRole('button', { name: /Send your CV/i })
    expect(link).toHaveAttribute('href', '/#candidate-enquiry')
    link.click()
  })

  it('renders role panels even when optional expertise cards are missing', () => {
    render(
      <RolePanels
        copy={translations.en}
        expertiseCards={[]}
        operationsRoles={[]}
        technologyRoles={[]}
      />,
    )

    expect(screen.getByRole('heading', { name: translations.en.titles.about.operationsTitle })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: translations.en.titles.about.technologyTitle })).toBeInTheDocument()
  })
})
