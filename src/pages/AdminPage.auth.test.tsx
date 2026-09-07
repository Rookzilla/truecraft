import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { AdminPage } from './AdminPage'

const candidate = {
  id: 'candidate-1',
  createdAt: '2026-08-31T10:00:00.000Z',
  updatedAt: '2026-08-31T10:00:00.000Z',
  status: 'potential' as const,
  scanStatus: 'NO_THREATS_FOUND',
  type: 'candidate',
  name: 'Alex Morgan',
  email: 'alex@example.com',
  phone: '07700 900123',
  role: 'Senior Engineer',
  message: 'Interested in platform roles.',
  company: 'TrueCraft',
  jobTitle: 'Backend Lead',
  notes: 'Strong AWS background',
  tags: ['aws', 'typescript'],
  cv: { filename: 'alex-cv.pdf', mimeType: 'application/pdf', size: 1048576 },
}

function candidatesResponse() {
  return {
    ok: true,
    json: async () => ({ candidates: [candidate] }),
  }
}

function storeAdminSession(accessToken = 'admin-access-token') {
  window.sessionStorage.setItem(
    'truecraft-admin-session',
    JSON.stringify({
      accessToken,
      expiresAt: Date.now() + 60 * 60 * 1000,
    }),
  )
}

afterEach(() => {
  window.sessionStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('AdminPage Cognito auth', () => {
  it('shows the Cognito login entrypoint and reports missing auth config', async () => {
    const user = userEvent.setup()

    render(<AdminPage />)

    await user.click(await screen.findByRole('button', { name: 'Log in with Cognito' }))

    expect(await screen.findByText('Admin login is not configured for this environment.')).toBeInTheDocument()
  })

  it('loads candidates with a stored Cognito access token', async () => {
    storeAdminSession()
    const fetchMock = vi.fn().mockResolvedValue(candidatesResponse())
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    expect(await screen.findByRole('heading', { name: 'Candidate Rolodex' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Alex Morgan/i })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith('/api/admin/candidates', {
      headers: { Authorization: 'Bearer admin-access-token' },
    })
  })

  it('returns to the login form when a stored admin token is rejected', async () => {
    storeAdminSession()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Admin login failed.' }),
      }),
    )

    render(<AdminPage />)

    expect(await screen.findByText('Admin login failed.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Log in with Cognito' })).toBeInTheDocument()
    expect(window.sessionStorage.getItem('truecraft-admin-session')).toBeNull()
  })
})
