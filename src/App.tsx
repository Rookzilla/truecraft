import { useCallback, useEffect, useMemo, useState } from 'react'
import { Minibar } from './components/ui/Minibar'
import { buildFormCopy, buildLocalizedContent } from './data/content'
import { translations, type Locale } from './i18n'
import { AboutPage, BusinessPage, CandidatesPage, HomePage, OpportunitiesPage } from './pages/HomePage'
import { activateContactTarget } from './utils/contactTarget'
import './App.css'

const routes = ['/', '/about', '/businesses', '/opportunities', '/candidates'] as const
type RoutePath = (typeof routes)[number]

const routeSet = new Set<string>(routes)

const getCurrentRoute = (): RoutePath => {
  const path = window.location.pathname
  return routeSet.has(path) ? (path as RoutePath) : '/'
}

function App() {
  const [isNightMode, setIsNightMode] = useState(false)
  const [locale, setLocale] = useState<Locale>('en')
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [route, setRoute] = useState<RoutePath>(getCurrentRoute)
  const [shouldHighlightContact, setShouldHighlightContact] = useState(() => window.location.hash === '#candidate-enquiry')

  const copy = translations[locale]
  const forms = buildFormCopy(copy)
  const content = buildLocalizedContent(copy)

  const minibarItems = [
    { href: '/about', label: copy.titles.nav.about },
    { href: '/businesses', label: copy.titles.nav.businesses },
    { href: '/opportunities', label: copy.titles.nav.roles },
    { href: '/candidates', label: copy.titles.nav.candidates },
  ]

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getCurrentRoute())
      setShouldHighlightContact(window.location.hash === '#candidate-enquiry')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [route])

  useEffect(() => {
    if (route !== '/candidates' || !shouldHighlightContact) return

    const timeout = window.setTimeout(() => {
      activateContactTarget()
      setShouldHighlightContact(false)
    }, 80)

    return () => window.clearTimeout(timeout)
  }, [route, shouldHighlightContact])

  const navigate = useCallback((href: string) => {
    const [path, hash = ''] = href.split('#')
    const nextRoute = routeSet.has(path) ? (path as RoutePath) : '/'
    const nextUrl = `${nextRoute}${hash ? `#${hash}` : ''}`

    if (window.location.pathname !== nextRoute || window.location.hash !== (hash ? `#${hash}` : '')) {
      window.history.pushState(null, '', nextUrl)
    }

    setRoute(nextRoute)
    setShouldHighlightContact(hash === 'candidate-enquiry')
  }, [])

  const handleContact = useCallback(() => {
    navigate('/candidates#candidate-enquiry')
  }, [navigate])

  const pageProps = useMemo(
    () => ({
      businessForm: forms.businessForm,
      candidateForm: forms.candidateForm,
      copy,
      expertiseCards: content.expertiseCards,
      lists: content.lists,
      onContact: handleContact,
      onNavigate: navigate,
      partnershipForm: forms.partnershipForm,
    }),
    [
      content.expertiseCards,
      content.lists,
      copy,
      forms.businessForm,
      forms.candidateForm,
      forms.partnershipForm,
      handleContact,
      navigate,
    ],
  )

  const currentPage = (() => {
    switch (route) {
      case '/about':
        return <AboutPage {...pageProps} />
      case '/businesses':
        return <BusinessPage {...pageProps} />
      case '/opportunities':
        return <OpportunitiesPage {...pageProps} />
      case '/candidates':
        return <CandidatesPage {...pageProps} />
      default:
        return <HomePage {...pageProps} />
    }
  })()

  return (
    <main className={isNightMode ? 'site-shell is-night' : 'site-shell'}>
      <Minibar
        isLanguageMenuOpen={isLanguageMenuOpen}
        isNightMode={isNightMode}
        items={minibarItems}
        labels={copy.titles.minibar}
        locale={locale}
        onChangeLocale={(nextLocale) => {
          setLocale(nextLocale)
          setIsLanguageMenuOpen(false)
        }}
        onNavigate={navigate}
        onToggleLanguageMenu={() => setIsLanguageMenuOpen((current) => !current)}
        onToggleNightMode={() => setIsNightMode((current) => !current)}
      />
      {currentPage}
    </main>
  )
}

export default App
