// Common disposable / temporary email domains
// Не е изчерпателен списък, но покрива най-популярните
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  '10minutemail.com',
  '10minutemail.net',
  'temp-mail.org',
  'tempmail.com',
  'tempmail.net',
  'throwawaymail.com',
  'yopmail.com',
  'maildrop.cc',
  'getnada.com',
  'sharklasers.com',
  'trashmail.com',
  'tempr.email',
  'dispostable.com',
  'fakeinbox.com',
  'mintemail.com',
  'mohmal.com',
  'emailondeck.com',
  'mytemp.email',
  'spamgourmet.com',
  'incognitomail.com',
  'tempinbox.com',
  'mailnesia.com',
  'tempmailaddress.com',
  'tempemailaddress.com',
  'fakemailgenerator.com',
  'discard.email',
  'dropmail.me',
  'minutemail.com',
  'mvrht.net',
  'spam4.me',
  'tempemail.net',
  'trash-mail.com',
  'wegwerfemail.de',
  'mail.tm',
  'inboxbear.com',
  'mailcatch.com'
])

// Strict email regex: requires real-looking domain with TLD of 2+ chars
const STRICT_EMAIL_REGEX =
  /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

export type EmailValidationResult =
  | { valid: true }
  | { valid: false; reason: string }

export function validateEmail(email: string): EmailValidationResult {
  const trimmed = email.trim().toLowerCase()

  if (!STRICT_EMAIL_REGEX.test(trimmed)) {
    return { valid: false, reason: 'Please enter a valid email address' }
  }

  // Extract domain (everything after the last @)
  const domain = trimmed.split('@')[1]

  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      valid: false,
      reason: 'Please use a permanent email address (no temporary inboxes)'
    }
  }

  // Reject obviously fake TLDs (single letter, all numbers, etc.)
  const tld = domain.split('.').pop() || ''
  if (tld.length < 2 || /^\d+$/.test(tld)) {
    return { valid: false, reason: 'Please enter a valid email address' }
  }

  return { valid: true }
}