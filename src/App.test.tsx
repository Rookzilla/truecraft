import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'

function renderAt(path: string) {
  window.history.pushState(null, '', path)
  return render(<App />)
}

describe('App', () => {
  it('renders the home page with primary sections', () => {
    renderAt('/')

    expect(screen.getByRole('heading', { level: 1, name: 'TrueCraft' })).toBeInTheDocument()
    expect(screen.getByText('Every business hires differently.')).toBeInTheDocument()
    expect(screen.getByText('Explore our latest vacancies below.')).toBeInTheDocument()
    expect(screen.getByText('Forge Your')).toBeInTheDocument()
  })

  it('renders direct route pages without the hero shell', () => {
    renderAt('/businesses')

    expect(screen.queryByRole('heading', { level: 1, name: 'TrueCraft' })).not.toBeInTheDocument()
    expect(screen.getByText('Every business hires differently.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Business enquiry' })).toBeInTheDocument()
  })

  it('renders each direct content route from the route table', () => {
    const view = renderAt('/about')
    expect(screen.getByText('About us')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1, name: 'TrueCraft' })).not.toBeInTheDocument()

    view.unmount()
    const opportunitiesView = renderAt('/opportunities')
    expect(screen.getByText('Explore our latest vacancies below.')).toBeInTheDocument()

    opportunitiesView.unmount()
    renderAt('/candidates')
    expect(screen.getByRole('heading', { name: 'Contact / Candidate Enquiry' })).toBeInTheDocument()
  })

  it('renders the admin route without public content sections', () => {
    renderAt('/admin')

    expect(screen.getByRole('heading', { name: 'TrueCraft Admin' })).toBeInTheDocument()
    expect(screen.queryByText('Every business hires differently.')).not.toBeInTheDocument()
  })

  it('falls back to the home page for unknown paths', () => {
    renderAt('/not-a-real-route')

    expect(screen.getByRole('heading', { level: 1, name: 'TrueCraft' })).toBeInTheDocument()
    expect(window.location.pathname).toBe('/not-a-real-route')
  })

  it('switches locale and closes the language menu', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(screen.getAllByRole('button', { name: /Site language: English/i })[0])
    await user.click(screen.getAllByRole('button', { name: 'Polski' })[0])

    expect(screen.getByText('Budujemy talenty. Ksztaltujemy kariery.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Jezyk strony: Polski/i })[0]).toHaveAttribute('aria-expanded', 'false')
  })

  it('toggles night mode from the minibar', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(screen.getAllByRole('button', { name: 'Enable night mode' })[0])

    expect(screen.getByRole('main')).toHaveClass('is-night')
    expect(screen.getAllByRole('button', { name: 'Disable night mode' })[0]).toHaveAttribute('aria-pressed', 'true')
  })

  it('navigates through minibar links and responds to browser history changes', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(screen.getByRole('link', { name: 'Businesses' }))
    expect(window.location.pathname).toBe('/')
    expect(window.location.hash).toBe('#businesses')

    window.history.pushState(null, '', '/opportunities')
    window.dispatchEvent(new PopStateEvent('popstate'))

    await waitFor(() => expect(screen.queryByRole('heading', { level: 1, name: 'TrueCraft' })).not.toBeInTheDocument())
    expect(screen.getByText('Explore our latest vacancies below.')).toBeInTheDocument()
  })

  it('activates the candidate contact section from the initial hash route', async () => {
    vi.useFakeTimers()
    renderAt('/#candidate-enquiry')

    await vi.advanceTimersByTimeAsync(100)

    expect(document.querySelector('.candidate-contact-panel')).toHaveClass('is-contact-highlighted')
  })

  it('routes hero contact clicks to the candidate enquiry section', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(screen.getAllByRole('link', { name: 'Contact' })[0])
    expect(window.location.hash).toBe('#candidate-enquiry')

    await waitFor(() => expect(document.querySelector('.candidate-contact-panel')).toHaveClass('is-contact-highlighted'))
  })

  it('uses hero mobile controls to change locale and night mode', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(screen.getAllByRole('button', { name: 'Enable night mode' })[1])
    expect(screen.getByRole('main')).toHaveClass('is-night')

    await user.click(screen.getAllByRole('button', { name: /Site language: English/i })[1])
    await user.click(screen.getAllByRole('button', { name: 'Polski' })[1])
    expect(screen.getByText('Budujemy talenty. Ksztaltujemy kariery.')).toBeInTheDocument()
  })

  it('scrolls to the top with reduced motion when navigating to the current route without a hash', async () => {
    const user = userEvent.setup()
    const scrollTo = vi.fn()

    Object.defineProperty(document.documentElement, 'scrollTo', {
      configurable: true,
      value: scrollTo,
    })
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

    renderAt('/')
    await user.click(screen.getByRole('link', { name: 'Back to top' }))

    await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: 'auto' }))
  })

  it('responds to operating-system color-scheme changes', () => {
    let colorSchemeListener: ((event: MediaQueryListEvent) => void) | undefined
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn((_event, listener) => {
        colorSchemeListener = listener as (event: MediaQueryListEvent) => void
      }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }))

    renderAt('/')
    expect(screen.getByRole('main')).not.toHaveClass('is-night')

    act(() => colorSchemeListener?.({ matches: true } as MediaQueryListEvent))
    expect(screen.getByRole('main')).toHaveClass('is-night')
  })
})
