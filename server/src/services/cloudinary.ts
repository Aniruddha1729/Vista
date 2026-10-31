import { createHash, randomUUID } from 'node:crypto'

type UploadedImage = { secure_url: string; public_id: string }

export async function uploadAvatarToCloudinary(file: Express.Multer.File, userId: string): Promise<UploadedImage> {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET
  if (!cloudName || !apiKey || !apiSecret) throw new Error('Cloudinary is not configured.')

  const timestamp = Math.floor(Date.now() / 1000).toString()
  const publicId = `avatar-${userId}-${randomUUID()}`
  const folder = 'vista/avatars'
  const signatureInput = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`
  const signature = createHash('sha1').update(signatureInput).digest('hex')
  const form = new FormData()
  form.set('file', new Blob([new Uint8Array(file.buffer)], { type: file.mimetype }), file.originalname)
  form.set('api_key', apiKey)
  form.set('timestamp', timestamp)
  form.set('folder', folder)
  form.set('public_id', publicId)
  form.set('signature', signature)

  const result = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(30_000),
  })
  const payload = await result.json().catch(() => ({})) as Partial<UploadedImage> & { error?: { message?: string } }
  if (!result.ok || !payload.secure_url || !payload.public_id) {
    console.error('Cloudinary avatar upload failed:', result.status, payload.error?.message || 'No provider detail returned.')
    throw new Error('Could not upload the profile image to Cloudinary.')
  }
  return { secure_url: payload.secure_url, public_id: payload.public_id }
}
