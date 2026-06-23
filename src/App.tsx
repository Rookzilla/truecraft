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

const getPreferredNightMode = () => window.matchMedia('(prefers-color-scheme: dark)').matches

const getCurrentRoute = (): RoutePath => {
  const path = window.location.pathname
  return routeSet.has(path) ? (path as RoutePath) : '/'
}

const scrollToPageTarget = (hash: string) => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  if (!hash) {
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? 'auto' : 'smooth' })
    return
  }

  document.getElementById(hash)?.scrollIntoView({
    behavior: reduceMotion ? 'auto' : 'smooth',
    block: 'start',
  })
}

function App() {
  const [isNightMode, setIsNightMode] = useState(getPreferredNightMode)
  const [locale, setLocale] = useState<Locale>('en')
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false)
  const [route, setRoute] = useState<RoutePath>(getCurrentRoute)
  const [shouldHighlightContact, setShouldHighlightContact] = useState(() => window.location.hash === '#candidate-enquiry')

  const copy = translations[locale]
  const forms = buildFormCopy(copy)
  const content = buildLocalizedContent(copy)

  const minibarItems = [
    { href: '/#about', label: copy.titles.nav.about },
    { href: '/#businesses', label: copy.titles.nav.businesses },
    { href: '/#opportunities', label: copy.titles.nav.roles },
    { href: '/#resources', label: copy.titles.nav.candidates },
  ]

  useEffect(() => {
    const colorScheme = window.matchMedia('(prefers-color-scheme: dark)')
    const handleColorSchemeChange = (event: MediaQueryListEvent) => {
      setIsNightMode(event.matches)
    }

    colorScheme.addEventListener('change', handleColorSchemeChange)
    return () => colorScheme.removeEventListener('change', handleColorSchemeChange)
  }, [])

  useEffect(() => {
    const handlePopState = () => {
      setRoute(getCurrentRoute())
      setShouldHighlightContact(window.location.hash === '#candidate-enquiry')
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    if (window.location.hash) return
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [route])

  useEffect(() => {
    if (route !== '/' || !window.location.hash || shouldHighlightContact) return

    const id = window.location.hash.slice(1)
    const timeout = window.setTimeout(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)

    return () => window.clearTimeout(timeout)
  }, [route, shouldHighlightContact])

  useEffect(() => {
    if ((route !== '/candidates' && route !== '/') || !shouldHighlightContact) return

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
    const isSameRoute = window.location.pathname === nextRoute

    if (window.location.pathname !== nextRoute || window.location.hash !== (hash ? `#${hash}` : '')) {
      window.history.pushState(null, '', nextUrl)
    }

    setRoute(nextRoute)
    setShouldHighlightContact(hash === 'candidate-enquiry')

    if (hash !== 'candidate-enquiry' && (isSameRoute || nextRoute === '/')) {
      window.setTimeout(() => scrollToPageTarget(hash), 80)
    }
  }, [])

  const handleContact = useCallback(() => {
    navigate('/#candidate-enquiry')
  }, [navigate])

  const pageProps = useMemo(
    () => ({
      businessForm: forms.businessForm,
      candidateForm: forms.candidateForm,
      copy,
      expertiseCards: content.expertiseCards,
      isLanguageMenuOpen,
      isNightMode,
      lists: content.lists,
      locale,
      onChangeLocale: (nextLocale: Locale) => {
        setLocale(nextLocale)
        setIsLanguageMenuOpen(false)
      },
      onContact: handleContact,
      onNavigate: navigate,
      onToggleNightMode: () => setIsNightMode((current) => !current),
      onToggleLanguageMenu: () => setIsLanguageMenuOpen((current) => !current),
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
      isLanguageMenuOpen,
      isNightMode,
      locale,
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
