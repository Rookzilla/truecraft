import { ShieldCheck } from 'lucide-react'
import { AnimatedCard } from '../../ui/AnimatedCard'
import type { LanguageCopy } from '../../../types/content'

export function PromisePanel({ copy }: { copy: LanguageCopy }) {
  return (
    <AnimatedCard className="mission-panel">
      <span className="card-icon">
        <ShieldCheck size={26} aria-hidden="true" />
      </span>
      <div>
        <span className="section-kicker">{copy.titles.about.promiseKicker}</span>
        <h3>{copy.titles.about.promiseTitle}</h3>
        <p>{copy.details.about.promiseText}</p>
      </div>
    </AnimatedCard>
  )
}
