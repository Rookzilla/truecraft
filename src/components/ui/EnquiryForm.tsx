import { useState, type FormEvent } from 'react'
import { ArrowRight, MessageSquareText, Upload } from 'lucide-react'
import { Button, Col, Form, InputGroup, Row } from 'react-bootstrap'
import type { FormConfig, TextField } from '../../types/content'

function getFieldName(controlId: string) {
  if (controlId.endsWith('-company')) return 'company'
  if (controlId.endsWith('-name')) return 'name'
  if (controlId.endsWith('-job-title')) return 'jobTitle'
  if (controlId.endsWith('-phone')) return 'phone'
  if (controlId.endsWith('-email')) return 'email'
  return controlId
}

function getFormValue(formData: FormData, name: string) {
  const value = formData.get(name)
  return typeof value === 'string' ? value : ''
}

function TextInput({ field }: { field: TextField }) {
  const control = (
    <Form.Control
      autoComplete={field.autoComplete}
      name={getFieldName(field.controlId)}
      placeholder={field.placeholder}
      required={field.required}
      type={field.type ?? 'text'}
    />
  )

  return (
    <Form.Group as={Col} md={field.md} xs={12} controlId={field.controlId}>
      <Form.Label>{field.label}</Form.Label>
      {field.icon ? (
        <InputGroup>
          <InputGroup.Text>
            <field.icon size={17} aria-hidden="true" />
          </InputGroup.Text>
          {control}
        </InputGroup>
      ) : (
        control
      )}
    </Form.Group>
  )
}

export function EnquiryForm({
  compact = false,
  config,
  showHeading = true,
}: {
  compact?: boolean
  config: FormConfig
  showHeading?: boolean
}) {
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedFile, setSelectedFile] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setStatus('')

    const form = event.currentTarget
    const formData = new FormData(form)
    const file = formData.get('cv')
    const values = {
      type: config.type,
      company: getFormValue(formData, 'company'),
      email: getFormValue(formData, 'email'),
      jobTitle: getFormValue(formData, 'jobTitle'),
      message: getFormValue(formData, 'message'),
      name: getFormValue(formData, 'name'),
      phone: getFormValue(formData, 'phone'),
      role: getFormValue(formData, 'jobTitle'),
    }

    try {
      if (file instanceof File && file.size > 0) {
        const extension = file.name.split('.').pop()?.toLowerCase()
        const isAllowedType =
          file.type === 'application/pdf' ||
          file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'

        if (!extension || !['pdf', 'docx'].includes(extension) || !isAllowedType) {
          setStatus('Please upload a CV as a PDF or DOCX file only.')
          setIsSubmitting(false)
          return
        }

        if (file.size > 10 * 1024 * 1024) {
          setStatus('Please upload a CV that is 10MB or smaller.')
          setIsSubmitting(false)
          return
        }

        const initResponse = await fetch('/api/submissions/init', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            ...values,
            file: {
              filename: file.name,
              mimeType: file.type,
              size: file.size,
            },
          }),
        })
        const initPayload = (await initResponse.json()) as {
          id?: string
          message?: string
          upload?: {
            url: string
            headers: Record<string, string>
          }
        }

        if (!initResponse.ok || !initPayload.id || !initPayload.upload) {
          throw new Error(initPayload.message ?? 'The CV upload could not be prepared.')
        }

        const uploadResponse = await fetch(initPayload.upload.url, {
          method: 'PUT',
          headers: initPayload.upload.headers,
          body: file,
        })

        if (!uploadResponse.ok) {
          throw new Error('The CV could not be uploaded.')
        }

        const completeResponse = await fetch(`/api/submissions/${initPayload.id}/complete`, {
          method: 'POST',
        })
        const completePayload = (await completeResponse.json()) as { message?: string }

        if (!completeResponse.ok) {
          throw new Error(completePayload.message ?? 'The CV submission could not be completed.')
        }

        form.reset()
        setSelectedFile('')
        setStatus(completePayload.message ?? config.success)
        return
      }

      const response = await fetch('/api/submissions', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(values),
      })
      const payload = (await response.json()) as { message?: string }

      if (!response.ok) throw new Error(payload.message ?? 'The submission could not be sent.')

      form.reset()
      setSelectedFile('')
      setStatus(payload.message ?? config.success)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'The submission could not be sent.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form className={compact ? 'compact-enquiry-form' : undefined} onSubmit={handleSubmit}>
      {showHeading ? (
        <div className="panel-heading compact-heading">
          <span className="card-icon">
            <MessageSquareText size={24} aria-hidden="true" />
          </span>
          <div>
            <h3>{config.title}</h3>
            <p>{config.intro}</p>
          </div>
        </div>
      ) : null}
      <Row className="g-3">
        {config.fields.map((field) => (
          <TextInput key={field.controlId} field={field} />
        ))}
        <Form.Group as={Col} xs={12} controlId={`${config.title.toLowerCase().replaceAll(' ', '-')}-comments`}>
          <Form.Label>{config.commentsLabel}</Form.Label>
          <InputGroup>
            <InputGroup.Text>
              <MessageSquareText size={17} aria-hidden="true" />
            </InputGroup.Text>
            <Form.Control as="textarea" name="message" rows={compact ? 3 : 5} placeholder={config.commentsPlaceholder} />
          </InputGroup>
        </Form.Group>
        {config.attachments ? (
          <Form.Group
            as={Col}
            md={compact ? 6 : undefined}
            xs={12}
            controlId={`${config.title.toLowerCase().replaceAll(' ', '-')}-attachments`}
          >
            <Form.Label>{config.attachmentLabel}</Form.Label>
            <label className="file-upload-control">
              <span>
                <Upload size={17} aria-hidden="true" />
              </span>
              <strong>{config.attachmentCta}</strong>
              <em>{selectedFile || config.attachmentHelp}</em>
              <Form.Control
                type="file"
                name="cv"
                accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={(event) => setSelectedFile((event.currentTarget as HTMLInputElement).files?.[0]?.name ?? '')}
              />
            </label>
          </Form.Group>
        ) : null}
        <Col className={compact ? 'compact-submit' : undefined} md={compact ? 6 : undefined} xs={12}>
          <Button type="submit" className="primary-action w-100" disabled={isSubmitting}>
            {isSubmitting ? 'Sending...' : config.buttonLabel}
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
          <p className="form-status" aria-live="polite">
            {status}
          </p>
        </Col>
      </Row>
    </Form>
  )
}
