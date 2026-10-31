export type TierAccount = {
  plan?: 'free' | 'pro'
  proExpiresAt?: Date | string | null
} | null | undefined

export function hasProTier(account: TierAccount, now = Date.now()) {
  if (account?.plan !== 'pro') return false
  if (!account.proExpiresAt) return true
  const expiresAt = new Date(account.proExpiresAt).getTime()
  return Number.isFinite(expiresAt) && expiresAt > now
}
