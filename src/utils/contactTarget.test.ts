import { beforeEach, describe, expect, it, vi } from 'vitest'
import { activateContactTarget } from './contactTarget'

describe('activateContactTarget', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
    vi.useFakeTimers()
  })

  it('scrolls the candidate enquiry into view and applies a temporary highlight', () => {
    document.body.innerHTML = `
      <section id="candidate-enquiry">
        <div class="candidate-contact-panel"></div>
      </section>
    `
    const target = document.getElementById('candidate-enquiry')
    const panel = document.querySelector('.candidate-contact-panel')

    activateContactTarget()

    expect(target?.scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' })
    expect(panel).toHaveClass('is-contact-highlighted')

    vi.advanceTimersByTime(2000)

    expect(panel).not.toHaveClass('is-contact-highlighted')
    vi.useRealTimers()
  })

  it('does nothing when the target panel is unavailable', () => {
    document.body.innerHTML = '<section id="candidate-enquiry"></section>'

    expect(() => activateContactTarget()).not.toThrow()
  })
})
