const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const phonePattern = /^\d{1,11}$/

export const normaliseContactFields = (fields = {}) => ({
  ...fields,
  email: typeof fields.email === 'string' ? fields.email.trim() : '',
  phone: typeof fields.phone === 'string' ? fields.phone.trim() : '',
})

export const validateContactFields = (fields = {}) => {
  const contactFields = normaliseContactFields(fields)

  if (!emailPattern.test(contactFields.email)) {
    return { valid: false, message: 'Please enter a valid email address.' }
  }

  if (contactFields.phone && !phonePattern.test(contactFields.phone)) {
    return { valid: false, message: 'Please enter a phone number using up to 11 digits only.' }
  }

  return { valid: true, fields: contactFields }
}
