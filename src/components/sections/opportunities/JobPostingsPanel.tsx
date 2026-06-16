import { BriefcaseBusiness, FileText } from 'lucide-react'
import type { LanguageCopy } from '../../../types/content'

export function JobPostingsPanel({ copy }: { copy: LanguageCopy }) {
  return (
    <div className="contact-panel opportunities-board">
      <div className="panel-heading compact-heading">
        <span className="card-icon">
          <BriefcaseBusiness size={24} aria-hidden="true" />
        </span>
        <div>
          <h3>{copy.titles.opportunities.postingsTitle}</h3>
          <p>{copy.details.opportunities.postingsText}</p>
        </div>
      </div>
      <div className="empty-role">
        <FileText size={32} aria-hidden="true" />
        <strong>{copy.titles.opportunities.emptyTitle}</strong>
        <span>{copy.details.opportunities.emptyText}</span>
      </div>
    </div>
  )
}
