import { ArrowRight } from 'lucide-react'
import { Button } from 'react-bootstrap'
import { AnimatedCard } from '../../ui/AnimatedCard'
import type { LanguageCopy } from '../../../types/content'

export function OpportunityIntroCard({ copy, onContact }: { copy: LanguageCopy; onContact?: () => void }) {
  return (
    <AnimatedCard className="question-panel opportunity-panel">
      <span>{copy.titles.opportunities.browseKicker}</span>
      <h3>{copy.titles.opportunities.browseTitle}</h3>
      <p>{copy.details.opportunities.browseText}</p>
      <div className="promise-list">
        <strong>{copy.titles.opportunities.promiseTitle}</strong>
        <span>{copy.details.opportunities.promiseOne}</span>
        <span>{copy.details.opportunities.promiseTwo}</span>
      </div>
      <Button
        href="/#candidate-enquiry"
        className="secondary-inline-action"
        onClick={(event) => {
          if (!onContact) return
          event.preventDefault()
          onContact()
        }}
      >
        {copy.actions.opportunities.cvCta}
        <ArrowRight size={17} aria-hidden="true" />
      </Button>
    </AnimatedCard>
  )
}
