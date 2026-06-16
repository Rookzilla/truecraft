import { Col, Container, Row } from 'react-bootstrap'
import { CandidateSupportPanel } from './candidates/CandidateSupportPanel'
import { ResourceCards } from './candidates/ResourceCards'
import { ContactBox } from '../ui/ContactBox'
import type { FormConfig, IconItem, LanguageCopy } from '../../types/content'

export function CandidateResourcesSection({
  candidateForm,
  copy,
  cvSupport,
  interviewSupport,
  onContact,
}: {
  candidateForm: FormConfig
  copy: LanguageCopy
  cvSupport: IconItem[]
  interviewSupport: IconItem[]
  onContact?: () => void
}) {
  return (
    <section id="resources" className="contact-section">
      <Container>
        <Row className="section-heading">
          <Col lg={9} xs={12}>
            <span className="section-kicker section-title-kicker">{copy.titles.resources.kicker}</span>
            <h2 className="resources-heading secondary-display-heading">
              {copy.titles.resources.titleOne} <em>{copy.titles.resources.titleEmphasis}</em>
            </h2>
            <p>{copy.details.resources.text}</p>
          </Col>
          <Col className="section-heading-action" lg={3} xs={12}>
            <ContactBox onContact={onContact} />
          </Col>
        </Row>

        <div className="copy-block no-top">
          <p>{copy.details.resources.intro}</p>
        </div>

        <ResourceCards copy={copy} cvSupport={cvSupport} interviewSupport={interviewSupport} />

        <Row className="g-4 enquiry-grid">
          <Col lg={12}>
            <div id="candidate-enquiry">
              <CandidateSupportPanel candidateForm={candidateForm} />
            </div>
          </Col>
        </Row>
      </Container>
    </section>
  )
}
