import { Col, Container, Row } from 'react-bootstrap'
import { JobPostingsPanel } from './opportunities/JobPostingsPanel'
import { OpportunityIntroCard } from './opportunities/OpportunityIntroCard'
import { ContactBox } from '../ui/ContactBox'
import type { LanguageCopy } from '../../types/content'

export function OpportunitiesSection({ copy, onContact }: { copy: LanguageCopy; onContact?: () => void }) {
  return (
    <section id="opportunities" className="content-section">
      <Container>
        <Row className="section-heading">
          <Col lg={9} xs={12}>
            <span className="section-kicker section-title-kicker">{copy.titles.opportunities.kicker}</span>
            <h2 className="opportunities-heading secondary-display-heading">
              {copy.titles.opportunities.compactTitleStart} <em>{copy.titles.opportunities.compactTitleEmphasis}</em>
            </h2>
            <p>{copy.details.opportunities.text}</p>
          </Col>
          <Col className="section-heading-action" lg={3} xs={12}>
            <ContactBox onContact={onContact} />
          </Col>
        </Row>

        <Row className="g-4 align-items-stretch">
          <Col lg={5}>
            <OpportunityIntroCard copy={copy} onContact={onContact} />
          </Col>
          <Col lg={7}>
            <JobPostingsPanel copy={copy} />
          </Col>
        </Row>
      </Container>
    </section>
  )
}
