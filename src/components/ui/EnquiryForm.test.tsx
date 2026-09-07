import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildFormCopy } from '../../data/content'
import { translations } from '../../i18n'
import { EnquiryForm } from './EnquiryForm'

const { businessForm, candidateForm } = buildFormCopy(translations.en)

function useBrowserLikeFormData() {
  class TestFormData {
    private readonly values = new Map<string, FormDataEntryValue>()

    constructor(form: HTMLFormElement) {
      form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach((field) => {
        if (!field.name) return

        if (field instanceof HTMLInputElement && field.type === 'file') {
          this.values.set(field.name, field.files?.[0] ?? new File([], ''))
          return
        }

        this.values.set(field.name, field.value)
      })
    }

    get(name: string) {
      return this.values.get(name) ?? null
    }
  }

  vi.stubGlobal('FormData', TestFormData)
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('EnquiryForm', () => {
  it('submits JSON form data when no file is selected', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Sent' }),
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<EnquiryForm config={businessForm} />)

    await user.type(screen.getByLabelText('Business'), 'Acme Ltd')
    await user.type(screen.getByLabelText('Name'), 'Alex Morgan')
    await user.type(screen.getByLabelText('Job title'), 'Talent Lead')
    await user.type(screen.getByLabelText('Email'), 'alex@example.com')
    await user.type(screen.getByLabelText('Comments'), 'We need help hiring engineers.')
    await user.click(screen.getByRole('button', { name: /Send business enquiry/i }))

    await waitFor(() => expect(screen.getByText('Sent')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith('/api/submissions', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'business',
        company: 'Acme Ltd',
        email: 'alex@example.com',
        jobTitle: 'Talent Lead',
        message: 'We need help hiring engineers.',
        name: 'Alex Morgan',
        phone: '',
        role: 'Talent Lead',
      }),
    })
  })

  it('rejects invalid email values before contacting the API', async () => {
    const user = userEvent.setup()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    render(<EnquiryForm config={businessForm} />)

    await user.type(screen.getByLabelText('Business'), 'Acme Ltd')
    await user.type(screen.getByLabelText('Name'), 'Alex Morgan')
    await user.type(screen.getByLabelText('Job title'), 'Talent Lead')
    await user.type(screen.getByLabelText('Email'), 'alex.example.com')
    await user.click(screen.getByRole('button', { name: /Send business enquiry/i }))

    expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('keeps phone input to digits only and caps it at 11 digits', async () => {
    const user = userEvent.setup()
    render(<EnquiryForm config={candidateForm} />)

    const phoneInput = screen.getByLabelText('Phone number')

    await user.type(phoneInput, 'abc07545 424483 extra')

    expect(phoneInput).toHaveValue('07545424483')
  })

  it('rejects CV uploads that are not PDF or DOCX files', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const fetchMock = vi.fn()
    useBrowserLikeFormData()
    vi.stubGlobal('fetch', fetchMock)

    render(<EnquiryForm config={candidateForm} />)

    await user.type(screen.getByLabelText('Name'), 'Sam Candidate')
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.upload(screen.getByLabelText(/Choose file/i), new File(['bad'], 'cv.txt', { type: 'text/plain' }))
    await user.click(screen.getByRole('button', { name: /Send enquiry/i }))

    expect(await screen.findByText('Please upload a CV as a PDF or DOCX file only.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('prepares, uploads, and completes valid CV submissions', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'submission-1',
          upload: { url: 'https://uploads.example/cv', headers: { 'x-upload': 'true' } },
        }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ message: 'CV received' }),
      })
    useBrowserLikeFormData()
    vi.stubGlobal('fetch', fetchMock)

    render(<EnquiryForm config={candidateForm} />)

    const file = new File(['pdf'], 'cv.pdf', { type: 'application/pdf' })
    await user.type(screen.getByLabelText('Name'), 'Sam Candidate')
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.type(screen.getByLabelText('Job title'), 'Developer')
    await user.upload(screen.getByLabelText(/Choose file/i), file)
    await user.click(screen.getByRole('button', { name: /Send enquiry/i }))

    await waitFor(() => expect(screen.getByText('CV received')).toBeInTheDocument())
    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/submissions/init',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"filename":"cv.pdf"'),
      }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://uploads.example/cv', {
      method: 'PUT',
      headers: { 'x-upload': 'true' },
      body: file,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(3, '/api/submissions/submission-1/complete', { method: 'POST' })
  })

  it('rejects CV uploads larger than 10MB before contacting the API', async () => {
    const user = userEvent.setup({ applyAccept: false })
    const fetchMock = vi.fn()
    useBrowserLikeFormData()
    vi.stubGlobal('fetch', fetchMock)

    render(<EnquiryForm config={candidateForm} compact showHeading={false} />)

    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large-cv.pdf', { type: 'application/pdf' })
    await user.type(screen.getByLabelText('Name'), 'Sam Candidate')
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.upload(screen.getByLabelText(/Choose file/i), file)
    expect(screen.getByText('large-cv.pdf')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Send enquiry/i }))

    expect(await screen.findByText('Please upload a CV that is 10MB or smaller.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    expect(screen.queryByRole('heading', { name: candidateForm.title })).not.toBeInTheDocument()
  })

  it('shows the API preparation error when CV upload initialization fails', async () => {
    const user = userEvent.setup({ applyAccept: false })
    useBrowserLikeFormData()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Monthly CV scanning limit reached' }),
      }),
    )

    render(<EnquiryForm config={candidateForm} />)

    await user.type(screen.getByLabelText('Name'), 'Sam Candidate')
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.upload(screen.getByLabelText(/Choose file/i), new File(['%PDF-body'], 'cv.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: /Send enquiry/i }))

    expect(await screen.findByText('Monthly CV scanning limit reached')).toBeInTheDocument()
  })

  it('uses fallback messages for missing CV preparation and completion API messages', async () => {
    const user = userEvent.setup({ applyAccept: false })
    useBrowserLikeFormData()
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 'submission-1' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'submission-1',
          upload: { url: 'https://uploads.example/cv', headers: {} },
        }),
      })
      .mockResolvedValueOnce({ ok: true })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })

    vi.stubGlobal('fetch', fetchMock)

    const { unmount } = render(<EnquiryForm config={candidateForm} />)
    await user.type(screen.getByLabelText('Name'), 'Sam Candidate')
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.upload(screen.getByLabelText(/Choose file/i), new File(['%PDF-body'], 'cv.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: /Send enquiry/i }))
    expect(await screen.findByText('The CV upload could not be prepared.')).toBeInTheDocument()

    unmount()
    render(<EnquiryForm config={candidateForm} />)
    await user.type(screen.getByLabelText('Name'), 'Sam Candidate')
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.upload(screen.getByLabelText(/Choose file/i), new File(['%PDF-body'], 'cv.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: /Send enquiry/i }))
    expect(await screen.findByText('The CV submission could not be completed.')).toBeInTheDocument()
  })

  it('shows an upload failure when the presigned PUT request fails', async () => {
    const user = userEvent.setup({ applyAccept: false })
    useBrowserLikeFormData()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'submission-1',
            upload: { url: 'https://uploads.example/cv', headers: {} },
          }),
        })
        .mockResolvedValueOnce({ ok: false }),
    )

    render(<EnquiryForm config={candidateForm} />)

    await user.type(screen.getByLabelText('Name'), 'Sam Candidate')
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.upload(screen.getByLabelText(/Choose file/i), new File(['%PDF-body'], 'cv.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: /Send enquiry/i }))

    expect(await screen.findByText('The CV could not be uploaded.')).toBeInTheDocument()
  })

  it('falls back to the configured CV success message when completion returns no message', async () => {
    const user = userEvent.setup({ applyAccept: false })
    useBrowserLikeFormData()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            id: 'submission-1',
            upload: { url: 'https://uploads.example/cv', headers: {} },
          }),
        })
        .mockResolvedValueOnce({ ok: true })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({}),
        }),
    )

    render(<EnquiryForm config={candidateForm} />)

    await user.type(screen.getByLabelText('Name'), 'Sam Candidate')
    await user.type(screen.getByLabelText('Email'), 'sam@example.com')
    await user.upload(screen.getByLabelText(/Choose file/i), new File(['%PDF-body'], 'cv.pdf', { type: 'application/pdf' }))
    await user.click(screen.getByRole('button', { name: /Send enquiry/i }))

    expect(await screen.findByText(candidateForm.success)).toBeInTheDocument()
  })

  it('uses the generic submission failure when the API omits an error message', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({}),
      }),
    )

    render(<EnquiryForm config={businessForm} />)

    await user.type(screen.getByLabelText('Business'), 'Acme Ltd')
    await user.type(screen.getByLabelText('Name'), 'Alex Morgan')
    await user.type(screen.getByLabelText('Job title'), 'Talent Lead')
    await user.type(screen.getByLabelText('Email'), 'alex@example.com')
    await user.click(screen.getByRole('button', { name: /Send business enquiry/i }))

    expect(await screen.findByText('The submission could not be sent.')).toBeInTheDocument()
  })

  it('falls back to configured success messages when APIs return no message', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      }),
    )

    render(<EnquiryForm config={businessForm} />)

    await user.type(screen.getByLabelText('Business'), 'Acme Ltd')
    await user.type(screen.getByLabelText('Name'), 'Alex Morgan')
    await user.type(screen.getByLabelText('Job title'), 'Talent Lead')
    await user.type(screen.getByLabelText('Email'), 'alex@example.com')
    await user.click(screen.getByRole('button', { name: /Send business enquiry/i }))

    expect(await screen.findByText(businessForm.success)).toBeInTheDocument()
  })

  it('shows API errors and re-enables submission', async () => {
    const user = userEvent.setup()
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        json: async () => ({ message: 'Submission failed' }),
      }),
    )

    render(<EnquiryForm config={businessForm} />)

    await user.type(screen.getByLabelText('Business'), 'Acme Ltd')
    await user.type(screen.getByLabelText('Name'), 'Alex Morgan')
    await user.type(screen.getByLabelText('Job title'), 'Talent Lead')
    await user.type(screen.getByLabelText('Email'), 'alex@example.com')
    await user.click(screen.getByRole('button', { name: /Send business enquiry/i }))

    await waitFor(() => expect(screen.getByText('Submission failed')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Send business enquiry/i })).toBeEnabled()
  })
})
