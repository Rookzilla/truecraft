const CONTACT_TARGET_ID = 'candidate-enquiry'
const HIGHLIGHT_CLASS = 'is-contact-highlighted'
const HIGHLIGHT_DURATION_MS = 2000

let highlightTimer: number | undefined

export function activateContactTarget() {
  const target = document.getElementById(CONTACT_TARGET_ID)
  const panel = target?.querySelector<HTMLElement>('.candidate-contact-panel')

  if (!target || !panel) return

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'center' })

  window.clearTimeout(highlightTimer)
  panel.classList.remove(HIGHLIGHT_CLASS)
  void panel.offsetWidth
  panel.classList.add(HIGHLIGHT_CLASS)

  highlightTimer = window.setTimeout(() => {
    panel.classList.remove(HIGHLIGHT_CLASS)
  }, HIGHLIGHT_DURATION_MS)
}
