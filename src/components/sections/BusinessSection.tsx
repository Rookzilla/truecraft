import { Search, UsersRound } from 'lucide-react'
import { Col, Container, Row } from 'react-bootstrap'
import { BusinessEnquiryPanels } from './business/BusinessEnquiryPanels'
import { ServiceCard } from './business/ServiceCard'
import { ContactBox } from '../ui/ContactBox'
import type { FormConfig, IconItem, LanguageCopy } from '../../types/content'

export function BusinessSection({
  businessForm,
  copy,
  contingencyExpectations,
  contingencyIdeal,
  embeddedExpectations,
  embeddedIdeal,
  embeddedServices,
  partnershipForm,
  onContact,
}: {
  businessForm: FormConfig
  copy: LanguageCopy
  contingencyExpectations: IconItem[]
  contingencyIdeal: IconItem[]
  embeddedExpectations: IconItem[]
  embeddedIdeal: IconItem[]
  embeddedServices: IconItem[]
  partnershipForm: FormConfig
  onContact?: () => void
}) {
  return (
    <section id="businesses" className="content-section business-section">
      <Container>
        <Row className="section-heading align-items-end">
          <Col lg={9} xs={12}>
            <span className="section-kicker section-title-kicker">{copy.titles.businesses.kicker}</span>
            <h2 className="single-line-heading">{copy.titles.businesses.title}</h2>
            <p>{copy.details.businesses.text}</p>
          </Col>
          <Col className="section-heading-action" lg={3} xs={12}>
            <ContactBox onContact={onContact} />
          </Col>
        </Row>

        <Row className="g-4 align-items-stretch">
          <Col lg={6}>
            <ServiceCard
              close={copy.details.businesses.contingencyClose}
              expectationItems={contingencyExpectations}
              expectLabel={copy.titles.businesses.expect}
              icon={Search}
              idealItems={contingencyIdeal}
              idealLabel={copy.titles.businesses.ideal}
              intro={copy.details.businesses.contingencyText}
              title={copy.titles.businesses.contingencyTitle}
            />
          </Col>
          <Col lg={6}>
            <ServiceCard
              additionalItems={embeddedServices}
              additionalLabel={copy.titles.businesses.additional}
              close={copy.details.businesses.embeddedClose}
              expectationItems={embeddedExpectations}
              expectLabel={copy.titles.businesses.expect}
              icon={UsersRound}
              idealItems={embeddedIdeal}
              idealLabel={copy.titles.businesses.ideal}
              intro={copy.details.businesses.embeddedText}
              title={copy.titles.businesses.embeddedTitle}
            />
          </Col>
        </Row>

        <BusinessEnquiryPanels businessForm={businessForm} partnershipForm={partnershipForm} />
      </Container>
    </section>
  )
}
