import { BriefcaseBusiness, Building2, Mail, Phone, UserRound } from 'lucide-react'
import type { FormConfig, LanguageCopy, TextField } from '../types/content'

function buildBusinessFields(copy: LanguageCopy): TextField[] {
  return [
    {
      controlId: 'business-company',
      label: copy.titles.forms.fields.business,
      placeholder: copy.titles.forms.fields.companyName,
      required: true,
      icon: Building2,
      autoComplete: 'organization',
      md: 6,
    },
    {
      controlId: 'business-name',
      label: copy.titles.forms.fields.name,
      placeholder: copy.titles.forms.fields.yourName,
      required: true,
      icon: UserRound,
      autoComplete: 'name',
      md: 6,
    },
    {
      controlId: 'business-job-title',
      label: copy.titles.forms.fields.jobTitle,
      placeholder: copy.titles.forms.fields.yourJobTitle,
      required: true,
      icon: BriefcaseBusiness,
      autoComplete: 'organization-title',
      md: 6,
    },
    {
      controlId: 'business-phone',
      label: copy.titles.forms.fields.phone,
      placeholder: copy.titles.forms.fields.phone,
      type: 'tel',
      icon: Phone,
      autoComplete: 'tel',
      md: 6,
    },
    {
      controlId: 'business-email',
      label: copy.titles.forms.fields.email,
      placeholder: copy.titles.forms.fields.emailAddress,
      type: 'email',
      required: true,
      icon: Mail,
      autoComplete: 'email',
    },
  ]
}

function buildCandidateFields(copy: LanguageCopy): TextField[] {
  return [
    {
      controlId: 'candidate-name',
      label: copy.titles.forms.fields.name,
      placeholder: copy.titles.forms.fields.yourName,
      required: true,
      icon: UserRound,
      autoComplete: 'name',
      md: 6,
    },
    {
      controlId: 'candidate-job-title',
      label: copy.titles.forms.fields.jobTitle,
      placeholder: copy.titles.forms.fields.currentTargetTitle,
      icon: BriefcaseBusiness,
      autoComplete: 'organization-title',
      md: 6,
    },
    {
      controlId: 'candidate-phone',
      label: copy.titles.forms.fields.phone,
      placeholder: copy.titles.forms.fields.phone,
      type: 'tel',
      icon: Phone,
      autoComplete: 'tel',
      md: 6,
    },
    {
      controlId: 'candidate-email',
      label: copy.titles.forms.fields.email,
      placeholder: copy.titles.forms.fields.emailAddress,
      type: 'email',
      required: true,
      icon: Mail,
      autoComplete: 'email',
      md: 6,
    },
  ]
}

export function buildFormCopy(copy: LanguageCopy) {
  const shared = {
    intro: copy.details.forms.intro,
    commentsLabel: copy.details.forms.comments,
    commentsPlaceholder: copy.details.forms.commentsPlaceholder,
    attachmentLabel: copy.details.forms.attachments,
    attachmentCta: copy.actions.forms.attachmentCta,
    attachmentHelp: copy.details.forms.attachmentHelp,
    success: copy.details.forms.success,
  }
  const businessFields = buildBusinessFields(copy)

  const businessForm: FormConfig = {
    ...shared,
    title: copy.titles.forms.businessTitle,
    fields: businessFields,
    attachments: true,
    buttonLabel: copy.actions.forms.businessButton,
  }

  const partnershipForm: FormConfig = {
    ...shared,
    title: copy.titles.forms.partnershipTitle,
    fields: businessFields.map((field) => ({
      ...field,
      controlId: field.controlId.replace('business-', 'partnership-'),
    })),
    attachments: true,
    buttonLabel: copy.actions.forms.partnershipButton,
  }

  const candidateForm: FormConfig = {
    ...shared,
    title: copy.titles.forms.candidateTitle,
    intro: copy.details.resources.supportText,
    fields: buildCandidateFields(copy),
    attachments: true,
    buttonLabel: copy.actions.forms.candidateButton,
  }

  return { businessForm, partnershipForm, candidateForm }
}
