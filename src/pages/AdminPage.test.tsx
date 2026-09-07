import { render, screen, waitFor, within } from '@testing-library/react'
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

function candidatesResponse(candidates: unknown[] = [candidate]) {
  return {
    ok: true,
    json: async () => ({ candidates }),
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

const adminHeaders = { Authorization: 'Bearer admin-access-token' }

afterEach(() => {
  window.sessionStorage.clear()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('AdminPage', () => {
  it('filters loaded candidates by searchable details', async () => {
    const user = userEvent.setup()
    storeAdminSession()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        candidatesResponse([
          candidate,
          {
            ...candidate,
            id: 'candidate-2',
            name: 'Jamie Patel',
            email: 'jamie@example.com',
            role: 'Finance Analyst',
            tags: ['finance'],
          },
        ]),
      ),
    )

    render(<AdminPage />)

    expect(await screen.findByRole('button', { name: /Alex Morgan/i })).toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('Search names, roles, notes, tags'), 'finance')

    expect(screen.queryByRole('button', { name: /Alex Morgan/i })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Jamie Patel/i })).toBeInTheDocument()
  })

  it('blocks CV download actions until the malware scan has passed', async () => {
    const user = userEvent.setup()
    storeAdminSession()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        candidatesResponse([
          {
            ...candidate,
            status: 'potential_scan_pending',
            scanStatus: 'SCAN_PENDING',
          },
        ]),
      ),
    )

    render(<AdminPage />)

    await user.click(await screen.findByRole('button', { name: /Alex Morgan/i }))
    const scanSection = screen.getByRole('heading', { name: /Scan Pending/i }).closest('section')

    expect(within(scanSection as HTMLElement).getByRole('button', { name: 'CV' })).toBeDisabled()
  })

  it('opens a short-lived CV URL after the malware scan has passed', async () => {
    const user = userEvent.setup()
    const openMock = vi.fn()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(candidatesResponse())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ url: 'https://example.com/signed-cv-url' }),
      })

    storeAdminSession()
    vi.stubGlobal('fetch', fetchMock)
    vi.stubGlobal('open', openMock)

    render(<AdminPage />)

    await user.click(await screen.findByRole('button', { name: /Alex Morgan/i }))
    await user.click(screen.getByRole('button', { name: 'CV' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith('/api/admin/candidates/candidate-1/cv-url', {
        method: 'POST',
        headers: adminHeaders,
      }),
    )
    expect(openMock).toHaveBeenCalledWith('https://example.com/signed-cv-url', '_blank', 'noopener,noreferrer')
  })

  it('updates notes, tags, and status actions through authenticated PATCH requests', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(candidatesResponse())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Candidate updated' }),
      })
      .mockResolvedValueOnce(candidatesResponse())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Candidate updated' }),
      })
      .mockResolvedValueOnce(candidatesResponse())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Candidate updated' }),
      })
      .mockResolvedValueOnce(candidatesResponse())
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Candidate updated' }),
      })
      .mockResolvedValueOnce(candidatesResponse())

    storeAdminSession()
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    await user.click(await screen.findByRole('button', { name: /Alex Morgan/i }))
    await user.clear(screen.getByLabelText('Notes'))
    await user.type(screen.getByLabelText('Notes'), 'Follow up next week')
    await user.tab()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/candidates/candidate-1', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...adminHeaders,
        },
        body: JSON.stringify({ notes: 'Follow up next week' }),
      }),
    )

    await user.clear(screen.getByLabelText('Tags'))
    await user.type(screen.getByLabelText('Tags'), 'node, aws')
    await user.tab()
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/candidates/candidate-1', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...adminHeaders,
        },
        body: JSON.stringify({ tags: ['node', 'aws'] }),
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/candidates/candidate-1', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...adminHeaders,
        },
        body: JSON.stringify({ status: 'publicly_available' }),
      }),
    )

    await user.click(screen.getByRole('button', { name: 'Cancel' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/candidates/candidate-1', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...adminHeaders,
        },
        body: JSON.stringify({ status: 'cancelled' }),
      }),
    )
  })

  it('allows approving candidates that do not have a CV attached', async () => {
    const user = userEvent.setup()
    const candidateWithoutCv = {
      ...candidate,
      cv: undefined,
      scanStatus: 'NOT_REQUIRED',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(candidatesResponse([candidateWithoutCv]))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Candidate updated' }),
      })
      .mockResolvedValueOnce(candidatesResponse([{ ...candidateWithoutCv, status: 'publicly_available' }]))

    storeAdminSession()
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    await user.click(await screen.findByRole('button', { name: /Alex Morgan/i }))
    expect(screen.getByRole('button', { name: 'CV' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Approve' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/candidates/candidate-1', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...adminHeaders,
        },
        body: JSON.stringify({ status: 'publicly_available' }),
      }),
    )
  })

  it('confirms before deleting cancelled candidates', async () => {
    const user = userEvent.setup()
    const cancelledCandidate = {
      ...candidate,
      status: 'cancelled',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(candidatesResponse([cancelledCandidate]))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Candidate deleted' }),
      })
      .mockResolvedValueOnce(candidatesResponse([]))

    storeAdminSession()
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    await user.click(await screen.findByRole('button', { name: /Alex Morgan/i }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))

    expect(screen.getByRole('dialog', { name: 'Are you sure?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete record' }))

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/candidates/candidate-1', {
        method: 'DELETE',
        headers: adminHeaders,
      }),
    )
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Are you sure?' })).not.toBeInTheDocument())
  })

  it('confirms before deleting accepted candidates', async () => {
    const user = userEvent.setup()
    const acceptedCandidate = {
      ...candidate,
      status: 'publicly_available',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(candidatesResponse([acceptedCandidate]))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Candidate deleted' }),
      })
      .mockResolvedValueOnce(candidatesResponse([]))

    storeAdminSession()
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    await user.click(await screen.findByRole('button', { name: /Alex Morgan/i }))
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    expect(screen.getByRole('dialog', { name: 'Are you sure?' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Delete record' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/candidates/candidate-1', {
        method: 'DELETE',
        headers: adminHeaders,
      }),
    )
  })

  it('moves accepted candidates back to the potential pool', async () => {
    const user = userEvent.setup()
    const acceptedCandidate = {
      ...candidate,
      status: 'publicly_available',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(candidatesResponse([acceptedCandidate]))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'Candidate updated' }),
      })
      .mockResolvedValueOnce(candidatesResponse([{ ...acceptedCandidate, status: 'potential' }]))

    storeAdminSession()
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    await user.click(await screen.findByRole('button', { name: /Alex Morgan/i }))
    await user.click(screen.getByRole('button', { name: 'Move to pool' }))
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith('/api/admin/candidates/candidate-1', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/json',
          ...adminHeaders,
        },
        body: JSON.stringify({ status: 'potential' }),
      }),
    )
  })

  it('shows update and CV errors without removing the admin session', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (url === '/api/admin/candidates') return Promise.resolve(candidatesResponse())
      if (init?.method === 'PATCH') {
        return Promise.resolve({
          ok: false,
          json: async () => ({ message: 'Update rejected' }),
        })
      }
      if (init?.method === 'POST') {
        return Promise.resolve({
          ok: false,
          json: async () => ({ message: 'CV scan pending' }),
        })
      }
      return Promise.resolve({
        ok: false,
        json: async () => ({ message: 'Unexpected request' }),
      })
    })

    storeAdminSession()
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    await user.click(await screen.findByRole('button', { name: /Alex Morgan/i }))
    await user.clear(screen.getByLabelText('Notes'))
    await user.type(screen.getByLabelText('Notes'), 'Needs review')
    await user.tab()

    expect(await screen.findByText('Update rejected')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'CV' }))
    expect(await screen.findByText('CV scan pending')).toBeInTheDocument()
    expect(window.sessionStorage.getItem('truecraft-admin-session')).toContain('admin-access-token')
  })

  it('uses the fallback admin update error message when the API omits a message', async () => {
    const user = userEvent.setup()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(candidatesResponse())
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

    storeAdminSession()
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    await user.click(await screen.findByRole('button', { name: /Alex Morgan/i }))
    await user.clear(screen.getByLabelText('Notes'))
    await user.type(screen.getByLabelText('Notes'), 'Needs review')
    await user.tab()
    expect(await screen.findByText('The candidate could not be updated.')).toBeInTheDocument()
  })

  it('shows rejected security warnings and can collapse an open candidate row', async () => {
    const user = userEvent.setup()
    storeAdminSession()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        candidatesResponse([
          {
            ...candidate,
            status: 'rejected_security',
            scanStatus: 'THREATS_FOUND',
          },
        ]),
      ),
    )

    render(<AdminPage />)

    const row = await screen.findByRole('button', { name: /Alex Morgan/i })
    await user.click(row)
    expect(screen.getByText('Blocked')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'CV' })).toBeDisabled()

    await user.click(row)
    expect(screen.queryByText('Blocked')).not.toBeInTheDocument()
  })

  it('supports refresh, logout, empty sections, and fallback candidate labels', async () => {
    const user = userEvent.setup()
    const fallbackCandidate = {
      ...candidate,
      name: '',
      role: '',
      jobTitle: '',
      company: '',
      message: '',
      phone: '',
      email: '',
      tags: ['untagged'],
      cv: undefined,
    }
    const fetchMock = vi.fn().mockResolvedValue(candidatesResponse([fallbackCandidate]))

    storeAdminSession()
    vi.stubGlobal('fetch', fetchMock)

    render(<AdminPage />)

    await user.click(await screen.findByRole('button', { name: /Unnamed candidate/i }))
    expect(screen.getByText('No role supplied')).toBeInTheDocument()
    expect(screen.getAllByText('Not supplied')).toHaveLength(2)
    expect(screen.getByText('No message supplied.')).toBeInTheDocument()
    expect(screen.getByText('No CV attached')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Refresh' }))
    expect(fetchMock).toHaveBeenCalledTimes(2)

    await user.click(screen.getByRole('button', { name: 'Log out' }))
    expect(screen.getByRole('button', { name: 'Log in with Cognito' })).toBeInTheDocument()
    expect(window.sessionStorage.getItem('truecraft-admin-session')).toBeNull()
  })
})
