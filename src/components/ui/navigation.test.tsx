import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { translations } from '../../i18n'
import { ContactBox } from './ContactBox'
import { LanguageSwitcher } from './LanguageSwitcher'
import { Minibar } from './Minibar'

describe('navigation UI', () => {
  it('routes minibar links through callbacks and toggles theme/language controls', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onChangeLocale = vi.fn()
    const onToggleLanguageMenu = vi.fn()
    const onToggleNightMode = vi.fn()
    const labels = translations.en.titles.minibar

    render(
      <Minibar
        isLanguageMenuOpen
        isNightMode={false}
        items={[
          { href: '/#about', label: 'About' },
          { href: '/#businesses', label: 'Businesses' },
        ]}
        labels={labels}
        locale="en"
        onChangeLocale={onChangeLocale}
        onNavigate={onNavigate}
        onToggleLanguageMenu={onToggleLanguageMenu}
        onToggleNightMode={onToggleNightMode}
      />,
    )

    await user.click(screen.getByRole('link', { name: labels.top }))
    await user.click(screen.getByRole('link', { name: 'Businesses' }))
    await user.click(screen.getByRole('button', { name: labels.nightOn }))
    await user.click(screen.getByRole('button', { name: /Site language: English/i }))
    await user.click(screen.getByRole('button', { name: 'Polski' }))

    expect(onNavigate).toHaveBeenNthCalledWith(1, '/')
    expect(onNavigate).toHaveBeenNthCalledWith(2, '/#businesses')
    expect(onToggleNightMode).toHaveBeenCalled()
    expect(onToggleLanguageMenu).toHaveBeenCalled()
    expect(onChangeLocale).toHaveBeenCalledWith('pl')
  })

  it('uses an explicit contact callback when supplied', async () => {
    const user = userEvent.setup()
    const onContact = vi.fn()

    render(<ContactBox inverse onContact={onContact} />)

    const link = screen.getByRole('link', { name: 'Contact' })
    expect(link).toHaveClass('section-contact-inverse')
    await user.click(link)

    expect(onContact).toHaveBeenCalled()
  })

  it('falls back to activating the candidate enquiry target without an explicit callback', async () => {
    const user = userEvent.setup()

    render(
      <>
        <section id="candidate-enquiry">
          <div className="candidate-contact-panel">
            <input />
          </div>
        </section>
        <ContactBox />
      </>,
    )
    const target = document.getElementById('candidate-enquiry') as HTMLElement
    const panel = target.querySelector('.candidate-contact-panel') as HTMLElement

    await user.click(screen.getByRole('link', { name: 'Contact' }))

    expect(panel).toHaveClass('is-contact-highlighted')
    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
  })

  it('uses reduced motion for fallback contact activation when requested', async () => {
    const user = userEvent.setup()
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    render(
      <>
        <section id="candidate-enquiry">
          <div className="candidate-contact-panel" />
        </section>
        <ContactBox />
      </>,
    )
    const target = document.getElementById('candidate-enquiry') as HTMLElement

    await user.click(screen.getByRole('link', { name: 'Contact' }))

    expect(target.scrollIntoView).toHaveBeenCalledWith({ behavior: 'auto', block: 'center' })
  })

  it('falls back to the first language when an unknown locale is supplied', () => {
    render(
      <LanguageSwitcher
        isOpen={false}
        label="Language"
        locale={'missing' as 'en'}
        onChange={vi.fn()}
        onToggle={vi.fn()}
      />,
    )

    expect(screen.getByRole('button', { name: 'Language: English' })).toBeInTheDocument()
  })
})
