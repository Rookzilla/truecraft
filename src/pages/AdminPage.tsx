import { useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Download, RotateCcw, Search, ShieldAlert, Trash2, XCircle } from 'lucide-react'
import {
  adminAuthHeader,
  clearAdminSession,
  completeAdminLoginFromCallback,
  getStoredAdminSession,
  logoutAdmin,
  startAdminLogin,
} from '../auth/cognito'

type CandidateStatus =
  | 'awaiting_upload'
  | 'potential_scan_pending'
  | 'potential'
  | 'publicly_available'
  | 'cancelled'
  | 'rejected_security'

type Candidate = {
  id: string
  createdAt: string
  updatedAt: string
  approvedAt?: string
  status: CandidateStatus
  scanStatus: string
  type: string
  name: string
  email: string
  phone: string
  role: string
  message: string
  company: string
  jobTitle: string
  notes: string
  tags: string[]
  cv?: {
    filename: string
    mimeType: string
    size: number
  }
}

const statusLabels: Record<CandidateStatus, string> = {
  awaiting_upload: 'Awaiting upload',
  potential_scan_pending: 'Scan pending',
  potential: 'Potential',
  publicly_available: 'Publicly available',
  cancelled: 'Cancelled',
  rejected_security: 'Security rejected',
}

const sections: Array<{ status: CandidateStatus; title: string }> = [
  { status: 'awaiting_upload', title: 'Awaiting Upload' },
  { status: 'potential_scan_pending', title: 'Scan Pending' },
  { status: 'potential', title: 'Potential' },
  { status: 'publicly_available', title: 'Publicly Available' },
  { status: 'cancelled', title: 'Cancelled' },
  { status: 'rejected_security', title: 'Security Rejected' },
]

function formatDate(value?: string) {
  if (!value) return 'Not set'
  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatSize(size?: number) {
  if (!size) return 'No file'
  return `${(size / 1024 / 1024).toFixed(2)} MB`
}

function isCvSafeToOpen(candidate: Candidate) {
  return Boolean(candidate.cv) && candidate.scanStatus === 'NO_THREATS_FOUND'
}

function canApprove(candidate: Candidate) {
  return !candidate.cv || candidate.scanStatus === 'NO_THREATS_FOUND'
}

function canDelete(candidate: Candidate) {
  return candidate.status === 'cancelled' || candidate.status === 'publicly_available'
}

export function AdminPage() {
  const [accessToken, setAccessToken] = useState(() => getStoredAdminSession()?.accessToken ?? '')
  const [isAuthReady, setIsAuthReady] = useState(false)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [openId, setOpenId] = useState<string>()
  const [pendingDelete, setPendingDelete] = useState<Candidate>()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('')

  const isLoggedIn = Boolean(accessToken)

  const loadCandidates = useCallback(async () => {
    if (!accessToken) return

    setStatus('Loading candidates...')
    const response = await fetch('/api/admin/candidates', {
      headers: adminAuthHeader(accessToken),
    })
    const payload = (await response.json()) as { candidates?: Candidate[]; message?: string }

    if (!response.ok) {
      clearAdminSession()
      setAccessToken('')
      setStatus(payload.message ?? 'Admin login failed.')
      return
    }

    setCandidates(payload.candidates ?? [])
    setStatus('')
  }, [accessToken])

  useEffect(() => {
    void completeAdminLoginFromCallback()
      .then((session) => {
        setAccessToken(session?.accessToken ?? '')
      })
      .catch((error: unknown) => {
        setStatus(error instanceof Error ? error.message : 'Admin login failed.')
      })
      .finally(() => setIsAuthReady(true))
  }, [])

  useEffect(() => {
    if (!isAuthReady) return

    const timeout = window.setTimeout(() => {
      void loadCandidates()
    }, 0)

    return () => window.clearTimeout(timeout)
  }, [isAuthReady, loadCandidates])

  const filteredCandidates = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return candidates

    return candidates.filter((candidate) =>
      [
        candidate.name,
        candidate.email,
        candidate.phone,
        candidate.role,
        candidate.jobTitle,
        candidate.company,
        candidate.message,
        candidate.notes,
        candidate.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle),
    )
  }, [candidates, query])

  const updateCandidate = async (candidate: Candidate, body: Record<string, unknown>) => {
    setStatus('Saving candidate...')
    const response = await fetch(`/api/admin/candidates/${candidate.id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        ...adminAuthHeader(accessToken),
      },
      body: JSON.stringify(body),
    })
    const payload = (await response.json()) as { message?: string }

    if (!response.ok) {
      setStatus(payload.message ?? 'The candidate could not be updated.')
      return
    }

    await loadCandidates()
  }

  const deleteCandidate = async (candidate: Candidate) => {
    setStatus('Deleting candidate...')
    const response = await fetch(`/api/admin/candidates/${candidate.id}`, {
      method: 'DELETE',
      headers: adminAuthHeader(accessToken),
    })
    const payload = (await response.json()) as { message?: string }

    if (!response.ok) {
      setStatus(payload.message ?? 'The candidate could not be deleted.')
      return
    }

    setPendingDelete(undefined)
    setOpenId(undefined)
    await loadCandidates()
  }

  const openCv = async (candidate: Candidate) => {
    setStatus('Preparing CV link...')
    const response = await fetch(`/api/admin/candidates/${candidate.id}/cv-url`, {
      method: 'POST',
      headers: adminAuthHeader(accessToken),
    })
    const payload = (await response.json()) as { url?: string; message?: string }

    if (!response.ok || !payload.url) {
      setStatus(payload.message ?? 'The CV is not available yet.')
      return
    }

    window.open(payload.url, '_blank', 'noopener,noreferrer')
    setStatus('')
  }

  if (!isAuthReady) {
    return (
      <section className="admin-page">
        <div className="admin-login">
          <h1>TrueCraft Admin</h1>
          <p>Checking admin session...</p>
        </div>
      </section>
    )
  }

  if (!isLoggedIn) {
    return (
      <section className="admin-page">
        <div className="admin-login">
          <h1>TrueCraft Admin</h1>
          <button
            type="button"
            onClick={() =>
              void startAdminLogin().catch((error: unknown) => {
                setStatus(error instanceof Error ? error.message : 'Admin login failed.')
              })
            }
          >
            Log in with Cognito
          </button>
          {status ? <p>{status}</p> : null}
        </div>
      </section>
    )
  }

  return (
    <section className="admin-page">
      <header className="admin-header">
        <div>
          <p>Admin Dashboard</p>
          <h1>Candidate Rolodex</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setAccessToken('')
            logoutAdmin()
          }}
        >
          Log out
        </button>
      </header>

      <div className="admin-toolbar">
        <label>
          <Search size={18} aria-hidden="true" />
          <input
            onChange={(event) => setQuery(event.currentTarget.value)}
            placeholder="Search names, roles, notes, tags"
            type="search"
            value={query}
          />
        </label>
        <button type="button" onClick={() => void loadCandidates()}>
          Refresh
        </button>
      </div>

      {status ? <p className="admin-status">{status}</p> : null}

      <div className="admin-sections">
        {sections.map((section) => {
          const sectionCandidates = filteredCandidates.filter((candidate) => candidate.status === section.status)

          return (
            <section className="admin-section" key={section.status}>
              <h2>
                {section.title}
                <span>{sectionCandidates.length}</span>
              </h2>
              <div className="candidate-list">
                {sectionCandidates.length ? (
                  sectionCandidates.map((candidate) => {
                    const isOpen = openId === candidate.id

                    return (
                      <article className="candidate-row" key={candidate.id}>
                        <button className="candidate-summary" type="button" onClick={() => setOpenId(isOpen ? undefined : candidate.id)}>
                          <span>
                            <strong>{candidate.name || 'Unnamed candidate'}</strong>
                            <em>{candidate.role || candidate.jobTitle || candidate.company || 'No role supplied'}</em>
                          </span>
                          <span>{statusLabels[candidate.status]}</span>
                        </button>

                        {isOpen ? (
                          <div className="candidate-detail">
                            <dl>
                              <div>
                                <dt>Email</dt>
                                <dd>{candidate.email || 'Not supplied'}</dd>
                              </div>
                              <div>
                                <dt>Phone</dt>
                                <dd>{candidate.phone || 'Not supplied'}</dd>
                              </div>
                              <div>
                                <dt>Submitted</dt>
                                <dd>{formatDate(candidate.createdAt)}</dd>
                              </div>
                              <div>
                                <dt>Scan</dt>
                                <dd>{candidate.scanStatus}</dd>
                              </div>
                              <div>
                                <dt>CV</dt>
                                <dd>{candidate.cv ? `${candidate.cv.filename} (${formatSize(candidate.cv.size)})` : 'No CV attached'}</dd>
                              </div>
                            </dl>

                            <p>{candidate.message || 'No message supplied.'}</p>

                            <div className="candidate-edit-grid">
                              <label>
                                Notes
                                <textarea
                                  defaultValue={candidate.notes}
                                  onBlur={(event) => void updateCandidate(candidate, { notes: event.currentTarget.value })}
                                  rows={3}
                                />
                              </label>
                              <label>
                                Tags
                                <input
                                  defaultValue={candidate.tags.filter((tag) => tag !== 'untagged').join(', ')}
                                  onBlur={(event) =>
                                    void updateCandidate(candidate, {
                                      tags: event.currentTarget.value
                                        .split(',')
                                        .map((tag) => tag.trim())
                                        .filter(Boolean),
                                    })
                                  }
                                  placeholder="Capabilities, locations, sectors"
                                />
                              </label>
                            </div>

                            <div className="candidate-actions">
                              <button
                                type="button"
                                disabled={!isCvSafeToOpen(candidate)}
                                onClick={() => void openCv(candidate)}
                              >
                                <Download size={17} aria-hidden="true" />
                                CV
                              </button>
                              <button
                                type="button"
                                disabled={candidate.status === 'publicly_available' || !canApprove(candidate)}
                                onClick={() => void updateCandidate(candidate, { status: 'publicly_available' })}
                              >
                                <CheckCircle2 size={17} aria-hidden="true" />
                                Approve
                              </button>
                              <button
                                type="button"
                                disabled={candidate.status !== 'publicly_available'}
                                onClick={() => void updateCandidate(candidate, { status: 'potential' })}
                              >
                                <RotateCcw size={17} aria-hidden="true" />
                                Move to pool
                              </button>
                              <button
                                type="button"
                                disabled={candidate.status === 'cancelled'}
                                onClick={() => void updateCandidate(candidate, { status: 'cancelled' })}
                              >
                                <XCircle size={17} aria-hidden="true" />
                                Cancel
                              </button>
                              <button
                                type="button"
                                className="danger-action"
                                disabled={!canDelete(candidate)}
                                onClick={() => setPendingDelete(candidate)}
                              >
                                <Trash2 size={17} aria-hidden="true" />
                                Delete
                              </button>
                              {candidate.status === 'rejected_security' ? (
                                <span className="candidate-warning">
                                  <ShieldAlert size={17} aria-hidden="true" />
                                  Blocked
                                </span>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </article>
                    )
                  })
                ) : (
                  <p className="empty-admin-section">No candidates here.</p>
                )}
              </div>
            </section>
          )
        })}
      </div>

      {pendingDelete ? (
        <div className="admin-modal-backdrop" role="presentation">
          <div aria-labelledby="delete-candidate-title" aria-modal="true" className="admin-modal" role="dialog">
            <h2 id="delete-candidate-title">Are you sure?</h2>
            <p>
              Delete {pendingDelete.name || 'this candidate'} permanently from the admin records
              {pendingDelete.cv ? ' and remove their CV file' : ''}.
            </p>
            <div className="admin-modal-actions">
              <button type="button" onClick={() => setPendingDelete(undefined)}>
                Keep record
              </button>
              <button type="button" className="danger-action" onClick={() => void deleteCandidate(pendingDelete)}>
                Delete record
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  )
}
