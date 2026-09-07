import { FileText, MessageSquareText } from 'lucide-react'
import { Col, Row } from 'react-bootstrap'
import { FeatureCard } from '../../ui/FeatureCard'
import type { IconItem, LanguageCopy } from '../../../types/content'

export function ResourceCards({
  copy,
  cvSupport,
  interviewSupport,
}: {
  copy: LanguageCopy
  cvSupport: IconItem[]
  interviewSupport: IconItem[]
}) {
  return (
    <Row className="g-4">
      <Col lg={6}>
        <FeatureCard
          copy={copy.details.resources.cvText}
          icon={FileText}
          items={cvSupport}
          title={copy.titles.resources.cvTitle}
        />
      </Col>
      <Col lg={6}>
        <FeatureCard
          copy={copy.details.resources.interviewText}
          icon={MessageSquareText}
          items={interviewSupport}
          title={copy.titles.resources.interviewTitle}
        />
      </Col>
    </Row>
  )
}
