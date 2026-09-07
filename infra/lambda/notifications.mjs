import { SendEmailCommand } from '@aws-sdk/client-ses'
import { ses } from './clients.mjs'
import { NOTIFICATION_EMAIL, SENDER_EMAIL } from './config.mjs'
import { escapeHtml } from './http.mjs'

export const sendNotification = async (candidate) => {
  const subjectMap = {
    business: 'TrueCraft Business Partnering Enquiry',
    partnership: 'TrueCraft Partnership Enquiry',
    candidate: 'TrueCraft Candidate CV Submission',
    other: 'TrueCraft Website Enquiry',
  }
  const adminUrl = process.env.ADMIN_URL ?? '/admin'
  const subject = subjectMap[candidate.type] ?? subjectMap.other
  const role = candidate.role || candidate.jobTitle

  await ses.send(
    new SendEmailCommand({
      Source: SENDER_EMAIL,
      Destination: { ToAddresses: [NOTIFICATION_EMAIL] },
      Message: {
        Subject: { Data: subject },
        Body: {
          Text: {
            Data: [
              `Submission: ${candidate.type}`,
              `Status: ${candidate.status}`,
              `Name: ${candidate.name}`,
              `Email: ${candidate.email}`,
              `Phone: ${candidate.phone}`,
              `Role: ${role}`,
              `Company: ${candidate.company}`,
              '',
              candidate.message,
              '',
              `Admin dashboard: ${adminUrl}`,
            ].join('\n'),
          },
          Html: {
            Data: `<h1>${escapeHtml(subject)}</h1>
              <table cellpadding="6" cellspacing="0" border="0">
                <tr><td><strong>Status</strong></td><td>${escapeHtml(candidate.status)}</td></tr>
                <tr><td><strong>Name</strong></td><td>${escapeHtml(candidate.name)}</td></tr>
                <tr><td><strong>Email</strong></td><td>${escapeHtml(candidate.email)}</td></tr>
                <tr><td><strong>Phone</strong></td><td>${escapeHtml(candidate.phone)}</td></tr>
                <tr><td><strong>Role</strong></td><td>${escapeHtml(role)}</td></tr>
                <tr><td><strong>Company</strong></td><td>${escapeHtml(candidate.company)}</td></tr>
              </table>
              <h2>Message</h2>
              <p>${escapeHtml(candidate.message)}</p>
              <p><a href="${escapeHtml(adminUrl)}">Open admin dashboard</a></p>`,
          },
        },
      },
    }),
  )
}
