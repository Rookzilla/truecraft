import { expect, test } from '@playwright/test'

test('home page supports navigation, localization, and contact submission affordance', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { level: 1, name: 'TrueCraft' })).toBeVisible()
  await expect(page.getByText('Every business hires differently.')).toBeVisible()

  await page.getByText('For Potential Candidates').click()
  await expect(page).toHaveURL(/#resources$/)
  const candidateEnquiry = page.locator('#candidate-enquiry')
  await expect(candidateEnquiry.getByRole('heading', { name: 'Contact / Candidate Enquiry' })).toBeVisible()
  await candidateEnquiry.getByLabel('Name').fill('Sam Candidate')
  await candidateEnquiry.getByLabel('Email').fill('sam@example.com')
  await expect(candidateEnquiry.getByRole('button', { name: /Send enquiry/i })).toBeEnabled()

  await page.getByRole('button', { name: /Site language: English/i }).first().click()
  await page.getByRole('button', { name: 'Polski' }).first().click()
  await expect(page.getByText('Budujemy talenty. Ksztaltujemy kariery.')).toBeVisible()
  await expect(candidateEnquiry.getByRole('button', { name: /Wyslij zapytanie kandydata/i })).toBeEnabled()
})
