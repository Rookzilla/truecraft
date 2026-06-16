import { Col, Row } from 'react-bootstrap'
import { AnimatedCard } from '../../ui/AnimatedCard'
import type { InfoCard } from '../../../types/content'

export function ExpertiseCards({ cards }: { cards: InfoCard[] }) {
  return (
    <Row className="g-4 feature-grid">
      {cards.map(({ icon: Icon, title, copy }) => (
        <Col md={4} key={title}>
          <AnimatedCard className="feature-card">
            <span className="card-icon">
              <Icon size={24} aria-hidden="true" />
            </span>
            <h3>{title}</h3>
            <p>{copy}</p>
          </AnimatedCard>
        </Col>
      ))}
    </Row>
  )
}
