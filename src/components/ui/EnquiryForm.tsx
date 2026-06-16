import { useState, type FormEvent } from 'react'
import { ArrowRight, MessageSquareText, Upload } from 'lucide-react'
import { Button, Col, Form, InputGroup, Row } from 'react-bootstrap'
import type { FormConfig, TextField } from '../../types/content'

function TextInput({ field }: { field: TextField }) {
  const control = (
    <Form.Control
      autoComplete={field.autoComplete}
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

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setStatus(config.success)
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
            <Form.Control as="textarea" rows={compact ? 3 : 5} placeholder={config.commentsPlaceholder} />
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
              <em>{config.attachmentHelp}</em>
              <Form.Control type="file" />
            </label>
          </Form.Group>
        ) : null}
        <Col className={compact ? 'compact-submit' : undefined} md={compact ? 6 : undefined} xs={12}>
          <Button type="submit" className="primary-action w-100">
            {config.buttonLabel}
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
