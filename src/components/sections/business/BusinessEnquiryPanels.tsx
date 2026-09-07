import { Col, Row } from 'react-bootstrap'
import { EnquiryForm } from '../../ui/EnquiryForm'
import type { FormConfig } from '../../../types/content'

export function BusinessEnquiryPanels({
  businessForm,
  partnershipForm,
}: {
  businessForm: FormConfig
  partnershipForm: FormConfig
}) {
  return (
    <Row className="g-4 enquiry-grid equal-form-grid">
      <Col lg={6}>
        <div className="brief-panel flame-panel">
          <EnquiryForm config={businessForm} />
        </div>
      </Col>
      <Col lg={6}>
        <div className="brief-panel flame-panel">
          <EnquiryForm config={partnershipForm} />
        </div>
      </Col>
    </Row>
  )
}
