import { Col, Row } from 'react-bootstrap'
import type { LanguageCopy } from '../../../types/content'
import { ContactBox } from '../../ui/ContactBox'

export function AboutHeader({ copy, onContact }: { copy: LanguageCopy; onContact?: () => void }) {
  return (
    <Row className="section-heading about-heading">
      <Col lg={9} xs={12}>
        <span className="section-kicker section-title-kicker">{copy.titles.about.kicker}</span>
        <h2 className="quote-heading">
          <span aria-hidden="true">“</span>
          {copy.titles.about.quote}
          <span aria-hidden="true">”</span>
        </h2>
        <p>{copy.details.about.text}</p>
      </Col>
      <Col className="section-heading-action" lg={3} xs={12}>
        <ContactBox onContact={onContact} />
      </Col>
    </Row>
  )
}
