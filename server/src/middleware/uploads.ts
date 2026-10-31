import multer from 'multer'

function imageOnly(allowedTypes: string[]) {
  return (_request: Express.Request, file: Express.Multer.File, callback: multer.FileFilterCallback) => {
    if (!allowedTypes.includes(file.mimetype)) return callback(new Error('Choose an accepted image file.'))
    callback(null, true)
  }
}

export const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: imageOnly(['image/jpeg', 'image/png', 'image/webp']),
})

export const screenshotUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024, files: 1 },
  fileFilter: imageOnly(['image/jpeg', 'image/png']),
})
