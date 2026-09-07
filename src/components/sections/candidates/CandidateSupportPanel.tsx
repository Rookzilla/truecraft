import { EnquiryForm } from '../../ui/EnquiryForm'
import type { FormConfig } from '../../../types/content'

export function CandidateSupportPanel({ candidateForm }: { candidateForm: FormConfig }) {
  return (
    <div className="contact-panel candidate-contact-panel">
      <div className="candidate-contact-heading">
        <h3>{candidateForm.title}</h3>
        <p>{candidateForm.intro}</p>
      </div>
      <EnquiryForm compact config={candidateForm} showHeading={false} />
    </div>
  )
}
