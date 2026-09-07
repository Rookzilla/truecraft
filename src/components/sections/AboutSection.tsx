import { Container } from 'react-bootstrap'
import { AboutHeader } from './about/AboutHeader'
import { ExperienceBlock } from './about/ExperienceBlock'
import { PromisePanel } from './about/PromisePanel'
import { RolePanels } from './about/RolePanels'
import type { IconItem, InfoCard, LanguageCopy } from '../../types/content'

export function AboutSection({
  copy,
  expertiseCards,
  hiringRealities,
  onContact,
  operationsRoles,
  technologyRoles,
}: {
  copy: LanguageCopy
  expertiseCards: InfoCard[]
  hiringRealities: IconItem[]
  onContact?: () => void
  operationsRoles: IconItem[]
  technologyRoles: IconItem[]
}) {
  return (
    <section id="about" className="content-section">
      <Container>
        <AboutHeader copy={copy} onContact={onContact} />
        <RolePanels
          copy={copy}
          expertiseCards={expertiseCards.slice(1)}
          operationsRoles={operationsRoles}
          technologyRoles={technologyRoles}
        />
        <ExperienceBlock copy={copy} hiringRealities={hiringRealities} />
        <PromisePanel copy={copy} />
      </Container>
    </section>
  )
}
