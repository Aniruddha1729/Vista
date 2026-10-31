const requiredVariables = [
  'MONGODB_URI',
  'JWT_ACCESS_SECRET',
  'JWT_REFRESH_SECRET',
  'QR_SIGNING_SECRET',
  'BREVO_API_KEY',
  'BREVO_SENDER_EMAIL',
  'CLIENT_URL',
  'GEMINI_API_KEY',
  'CLOUDINARY_CLOUD_NAME',
  'CLOUDINARY_API_KEY',
  'CLOUDINARY_API_SECRET',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET',
  'RAZORPAY_WEBHOOK_SECRET',
  'BANK_DETAILS_ENCRYPTION_KEY',
] as const

export function validateEnvironment() {
  const missing = requiredVariables.filter((name) => !process.env[name]?.trim())
  if (missing.length) throw new Error(`Missing required environment variables: ${missing.join(', ')}.`)

  if (!/^[a-f\d]{64}$/i.test(process.env.BANK_DETAILS_ENCRYPTION_KEY || '')) {
    throw new Error('BANK_DETAILS_ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes).')
  }

  const port = Number(process.env.PORT || 4000)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid port number between 1 and 65535.')

  const razorpayKeyId = process.env.RAZORPAY_KEY_ID || ''
  if (!razorpayKeyId.startsWith('rzp_test_')) throw new Error('Only Razorpay test keys are enabled in this deployment configuration. Set RAZORPAY_KEY_ID to an rzp_test_ key.')

  const origins = (process.env.CLIENT_URL || '').split(',').map((origin) => origin.trim()).filter(Boolean)
  if (!origins.length || origins.some((origin) => {
    try { return new URL(origin).origin !== origin.replace(/\/$/, '') } catch { return true }
  })) throw new Error('CLIENT_URL must contain one or more valid origins, separated by commas, with no paths.')

  if (!process.env.NODE_ENV) process.env.NODE_ENV = 'development'
}
