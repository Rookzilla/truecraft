import { Mail } from 'lucide-react'
import { activateContactTarget } from '../../utils/contactTarget'

export function ContactBox({ inverse = false, onContact }: { inverse?: boolean; onContact?: () => void }) {
  return (
    <a
      className={inverse ? 'section-contact section-contact-inverse' : 'section-contact'}
      href="/candidates#candidate-enquiry"
      onClick={(event) => {
        event.preventDefault()
        if (onContact) {
          onContact()
          return
        }
        activateContactTarget()
      }}
    >
      <Mail size={18} aria-hidden="true" />
      <span>Contact</span>
    </a>
  )
}
