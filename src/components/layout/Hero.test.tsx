import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildLocalizedContent } from '../../data/content'
import { translations } from '../../i18n'
import { Hero } from './Hero'

const copy = translations.en
const props = {
  copy,
  isLanguageMenuOpen: false,
  isNightMode: false,
  locale: 'en' as const,
  onChangeLocale: vi.fn(),
  onContact: vi.fn(),
  onNavigate: vi.fn(),
  onToggleLanguageMenu: vi.fn(),
  onToggleNightMode: vi.fn(),
}

describe('Hero', () => {
  it('renders the brand, primary copy, and hero calls to action', () => {
    render(<Hero {...props} />)

    expect(screen.getByRole('link', { name: 'TrueCraft home' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: copy.titles.hero.title })).toBeInTheDocument()
    expect(screen.getByText(copy.titles.hero.tagline)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.titles.minibar.nightOn })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: new RegExp(copy.actions.hero.businessCta) })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: copy.actions.hero.candidateCta })).toBeInTheDocument()
  })

  it('opens and closes the mobile navigation while routing links through callbacks', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onContact = vi.fn()

    render(<Hero {...props} onContact={onContact} onNavigate={onNavigate} />)

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(screen.getByRole('button', { name: 'Close navigation' })).toHaveAttribute('aria-expanded', 'true')

    await user.click(screen.getByRole('link', { name: copy.titles.nav.businessesTop }))
    expect(onNavigate).toHaveBeenCalledWith('/#businesses')
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false')

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    await user.click(screen.getByRole('link', { name: copy.titles.nav.candidatesTop }))
    expect(onNavigate).toHaveBeenCalledWith('/#resources')
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false')

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    await user.click(screen.getByRole('link', { name: copy.titles.nav.opportunitiesTop }))
    expect(onNavigate).toHaveBeenCalledWith('/#opportunities')
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute('aria-expanded', 'false')

    await user.click(screen.getByRole('button', { name: 'Open navigation' }))
    await user.click(screen.getByRole('link', { name: 'Contact' }))
    expect(onContact).toHaveBeenCalled()
  })

  it('routes brand and hero CTA clicks without changing document location directly', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()

    render(<Hero {...props} onNavigate={onNavigate} />)

    await user.click(screen.getByRole('link', { name: 'TrueCraft home' }))
    await user.click(screen.getByRole('button', { name: new RegExp(copy.actions.hero.businessCta) }))
    await user.click(screen.getByRole('button', { name: copy.actions.hero.candidateCta }))

    expect(onNavigate).toHaveBeenNthCalledWith(1, '/')
    expect(onNavigate).toHaveBeenNthCalledWith(2, '/#businesses')
    expect(onNavigate).toHaveBeenNthCalledWith(3, '/#resources')
  })

  it('exposes language and theme controls for compact/mobile contexts', async () => {
    const user = userEvent.setup()
    const onChangeLocale = vi.fn()
    const onToggleLanguageMenu = vi.fn()
    const onToggleNightMode = vi.fn()

    render(
      <Hero
        {...props}
        isLanguageMenuOpen
        isNightMode
        onChangeLocale={onChangeLocale}
        onToggleLanguageMenu={onToggleLanguageMenu}
        onToggleNightMode={onToggleNightMode}
      />,
    )

    await user.click(screen.getByRole('button', { name: copy.titles.minibar.nightOff }))
    await user.click(screen.getByRole('button', { name: /Site language: English/i }))
    await user.click(screen.getByRole('button', { name: 'Polski' }))

    expect(onToggleNightMode).toHaveBeenCalled()
    expect(onToggleLanguageMenu).toHaveBeenCalled()
    expect(onChangeLocale).toHaveBeenCalledWith('pl')
  })

  it('uses the same localized content consumed by the full home page', () => {
    const content = buildLocalizedContent(copy)

    render(<Hero {...props} />)

    expect(content.expertiseCards.length).toBeGreaterThan(0)
    expect(screen.getByText(copy.details.hero.text)).toBeInTheDocument()
  })
})
