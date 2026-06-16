import { useState } from 'react'
import { ArrowRight, Menu, X } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button, Col, Container, Nav, Row } from 'react-bootstrap'
import heroImage from '../../assets/truecraft-forge-hero.png'
import type { LanguageCopy } from '../../types/content'

export function Hero({
  copy,
  onNavigate,
  onContact,
}: {
  copy: LanguageCopy
  onNavigate: (href: string) => void
  onContact: () => void
}) {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const closeMenu = () => setIsMenuOpen(false)

  return (
    <section className="hero-section">
      <img className="hero-image" src={heroImage} alt="" aria-hidden="true" />
      <div className="hero-overlay" />
      <Container className="position-relative">
        <Nav className="site-nav align-items-center justify-content-between">
          <a
            className="brand-mark"
            href="/"
            aria-label="TrueCraft home"
            onClick={(event) => {
              event.preventDefault()
              closeMenu()
              onNavigate('/')
            }}
          >
            <span>TC</span>
            TrueCraft
          </a>
          <button
            aria-controls="site-navigation"
            aria-expanded={isMenuOpen}
            aria-label={isMenuOpen ? 'Close navigation' : 'Open navigation'}
            className="nav-toggle"
            onClick={() => setIsMenuOpen((current) => !current)}
            type="button"
          >
            {isMenuOpen ? <X size={24} aria-hidden="true" /> : <Menu size={24} aria-hidden="true" />}
          </button>
          <div className={isMenuOpen ? 'nav-actions is-open' : 'nav-actions'} id="site-navigation">
            <a
              href="/#businesses"
              onClick={(event) => {
                event.preventDefault()
                closeMenu()
                onNavigate('/#businesses')
              }}
            >
              {copy.titles.nav.businessesTop}
            </a>
            <a
              href="/#opportunities"
              onClick={(event) => {
                event.preventDefault()
                closeMenu()
                onNavigate('/#opportunities')
              }}
            >
              {copy.titles.nav.opportunitiesTop}
            </a>
            <a
              href="/#resources"
              onClick={(event) => {
                event.preventDefault()
                closeMenu()
                onNavigate('/#resources')
              }}
            >
              {copy.titles.nav.candidatesTop}
            </a>
            <a
              href="/#candidate-enquiry"
              onClick={(event) => {
                event.preventDefault()
                closeMenu()
                onContact()
              }}
            >
              Contact
            </a>
          </div>
        </Nav>

        <Row id="top" className="min-vh-100 align-items-center hero-grid">
          <Col lg={7} xl={6}>
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="hero-copy"
            >
              <h1>{copy.titles.hero.title}</h1>
              <p className="tagline">{copy.titles.hero.tagline}</p>
              <p className="hero-text">{copy.details.hero.text}</p>
              <div className="hero-actions">
                <Button
                  href="/#businesses"
                  size="lg"
                  className="primary-action"
                  onClick={(event) => {
                    event.preventDefault()
                    onNavigate('/#businesses')
                  }}
                >
                  {copy.actions.hero.businessCta}
                  <ArrowRight size={18} aria-hidden="true" />
                </Button>
                <Button
                  href="/#resources"
                  size="lg"
                  variant="outline-light"
                  className="ghost-action"
                  onClick={(event) => {
                    event.preventDefault()
                    onNavigate('/#resources')
                  }}
                >
                  {copy.actions.hero.candidateCta}
                </Button>
              </div>
            </motion.div>
          </Col>
        </Row>
      </Container>
    </section>
  )
}
