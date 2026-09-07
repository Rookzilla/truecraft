import { Col, Row } from 'react-bootstrap'
import { AnimatedCard } from '../../ui/AnimatedCard'
import { IconGrid } from '../../ui/IconLists'
import type { IconItem, InfoCard, LanguageCopy } from '../../../types/content'

export function RolePanels({
  copy,
  expertiseCards,
  operationsRoles,
  technologyRoles,
}: {
  copy: LanguageCopy
  expertiseCards: InfoCard[]
  operationsRoles: IconItem[]
  technologyRoles: IconItem[]
}) {
  const [technologyCard, operationsCard] = expertiseCards

  const renderExpertiseCard = (card: InfoCard | undefined) => {
    if (!card) return null
    const Icon = card.icon

    return (
      <AnimatedCard className="feature-card expertise-role-card">
        <span className="card-icon">
          <Icon size={24} aria-hidden="true" />
        </span>
        <h3>{card.title}</h3>
        <p>{card.copy}</p>
      </AnimatedCard>
    )
  }

  return (
    <div className="role-expertise-grid">
      <Row className="g-4 align-items-stretch">
        <Col lg={6}>{renderExpertiseCard(operationsCard)}</Col>
        <Col lg={6}>{renderExpertiseCard(technologyCard)}</Col>
      </Row>
      <Row className="g-4 align-items-stretch role-list-grid">
        <Col lg={6}>
          <AnimatedCard className="question-panel">
            <span>{copy.titles.about.operationsKicker}</span>
            <h3>{copy.titles.about.operationsTitle}</h3>
            <IconGrid items={operationsRoles} />
          </AnimatedCard>
        </Col>
        <Col lg={6}>
          <AnimatedCard className="question-panel">
            <span>{copy.titles.about.technologyKicker}</span>
            <h3>{copy.titles.about.technologyTitle}</h3>
            <IconGrid items={technologyRoles} />
          </AnimatedCard>
        </Col>
      </Row>
    </div>
  )
}
