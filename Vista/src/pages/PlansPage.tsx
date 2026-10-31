import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { authenticatedFetch } from '../auth/authenticatedFetch'
import PixelCard from '../components/PixelCard'
import { SidebarUnfoldableExample } from '../components/Sidebar'
import './PlansPage.css'

const freeFeatures = [
  'Create and share campus events',
  'Core email invitation designs',
  'Team registration and event permissions',
  'Manage registrations and entry tickets',
]

const proFeatures = [
  'More premium invitation templates',
  'Paid event registrations',
  'Guaranteed immediate payment withdrawals',
  'Unlimited event permissions',
  'Enhanced event pages',
  'Unlimited invitations',
]

function PlansPage() {
  const { user, accessToken, updateUser } = useAuth()
  const isPro = user?.plan === 'pro'
  const [checkoutBusy, setCheckoutBusy] = useState(false)
  const [checkoutError, setCheckoutError] = useState('')
  const [checkoutMessage, setCheckoutMessage] = useState('')

  async function startProCheckout() {
    if (!user || !accessToken) return
    setCheckoutBusy(true)
    setCheckoutError('')
    setCheckoutMessage('')
    try {
      const response = await authenticatedFetch('/api/events/billing/pro/subscription', { method: 'POST', credentials: 'include', headers: { Authorization: `Bearer ${accessToken}` } })
      const result = await response.json() as { subscriptionId?: string; keyId?: string; customerName?: string; customerEmail?: string; message?: string }
      if (!response.ok || !result.subscriptionId || !result.keyId) throw new Error(result.message || 'Could not start Pro checkout.')
      const openCheckout = () => {
        const Razorpay = (window as Window & { Razorpay?: new (options: Record<string, unknown>) => { open: () => void } }).Razorpay
        if (!Razorpay) { setCheckoutError('Razorpay Checkout did not load. Please try again.'); setCheckoutBusy(false); return }
        const checkout = new Razorpay({
          key: result.keyId, subscription_id: result.subscriptionId, name: 'Vista', description: 'Vista Pro · ₹500 per month',
          prefill: { name: result.customerName, email: result.customerEmail }, theme: { color: '#c8f246' },
          handler: async (payment: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
            try {
              const verifyResponse = await authenticatedFetch('/api/events/billing/pro/verify', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify(payment) })
              const verified = await verifyResponse.json() as { plan?: string; message?: string }
              if (!verifyResponse.ok) throw new Error(verified.message || 'Could not verify your Pro subscription.')
              if (verified.plan === 'pro' && user) updateUser({ ...user, plan: 'pro' })
              setCheckoutMessage(verified.message || 'Subscription confirmed. Razorpay will activate Pro after its first successful charge.')
            } catch (failure) {
              setCheckoutError(failure instanceof Error ? failure.message : 'Could not verify your Pro subscription.')
            } finally { setCheckoutBusy(false) }
          },
          modal: { ondismiss: () => setCheckoutBusy(false) },
        })
        checkout.open()
      }
      if ((window as Window & { Razorpay?: unknown }).Razorpay) openCheckout()
      else {
        const script = document.createElement('script')
        script.src = 'https://checkout.razorpay.com/v1/checkout.js'
        script.onload = openCheckout
        script.onerror = () => { setCheckoutError('Could not load Razorpay Checkout.'); setCheckoutBusy(false) }
        document.body.appendChild(script)
      }
    } catch (failure) {
      setCheckoutError(failure instanceof Error ? failure.message : 'Could not start Pro checkout.')
      setCheckoutBusy(false)
    }
  }

  return (
    <div className="plans-layout">
      <aside className="plans-sidebar"><SidebarUnfoldableExample /></aside>
      <main className="plans-page">
      <div className="plans-shell">
        <header className="plans-heading">
          <span className="section-eyebrow">Vista plans</span>
          <h1>Make room for<br /><em>what’s next.</em></h1>
          <p>Keep creating with Free, or upgrade to Pro for more room to host and grow.</p>
        </header>

        <div className="plans-current"><span className="plans-current-dot" />Your current plan: <strong>{isPro ? 'Pro' : 'Free'}</strong></div>

        <section className="plans-grid" aria-label="Compare Vista plans">
          <PixelCard
            className="plan-pixel-card plan-free-card"
            colors={['#dce9bd', '#c5db88', '#9caf63']}
            glowColor="#9caf63"
            gap={8}
            pixelSize={2.5}
            speed={22}
            shape="square"
            origin="center"
            revealDuration={700}
            spotlight={0.32}
            glow={0.35}
            opacity={0.32}
            fade={0.65}
            trigger="hover"
            clickPulse
            intro
            theme="light"
            radius={26}
            introDelay={0}
          >
            <div className="plan-card-content">
              <div className="plan-card-topline"><span className="plan-name">Free</span>{!isPro && <span className="plan-current-tag">Current plan</span>}</div>
              <div className="plan-price">₹0 <span>forever</span></div>
              <p className="plan-description">Everything you need to bring campus events together.</p>
              <ul className="plan-feature-list">{freeFeatures.map((feature) => <li key={feature}><span aria-hidden="true">✓</span>{feature}</li>)}</ul>
              <Link className={`plan-action plan-action-free${!isPro ? ' is-current' : ''}`} to="/events">{isPro ? 'Explore Vista' : 'Your current plan'}</Link>
            </div>
          </PixelCard>

          <PixelCard
            className="plan-pixel-card plan-pro-card"
            colors={['#d8f66a', '#b9e746', '#8faf24']}
            glowColor="#b9e746"
            gap={7}
            pixelSize={2.8}
            speed={30}
            shape="square"
            origin="center"
            revealDuration={760}
            spotlight={0.48}
            glow={0.48}
            opacity={0.38}
            fade={0.58}
            trigger="hover"
            clickPulse
            intro
            theme="dark"
            radius={26}
            introDelay={160}
          >
            <div className="plan-card-content">
              <div className="plan-card-topline"><span className="plan-name">Pro</span>{isPro ? <span className="plan-current-tag pro-current-tag">Current plan</span> : <span className="plan-coming-tag">Monthly plan</span>}</div>
              <div className="plan-price pro-price">₹500<span>per month</span></div>
              <p className="plan-description">For organisers who want more reach, flexibility, and control.</p>
              <ul className="plan-feature-list">{proFeatures.map((feature) => <li key={feature}><span aria-hidden="true">✦</span>{feature}</li>)}</ul>
              {user ? <button className="plan-action plan-action-pro" type="button" disabled={isPro || checkoutBusy} onClick={() => void startProCheckout()}>{isPro ? 'Your current plan' : checkoutBusy ? 'Opening secure checkout…' : 'Upgrade to Pro'}</button> : <Link className="plan-action plan-action-pro" to="/login">Sign in to upgrade</Link>}
            </div>
          </PixelCard>
        </section>

        {checkoutError && <p className="plans-note plans-checkout-error" role="alert">{checkoutError}</p>}{checkoutMessage && <p className="plans-note plans-checkout-message" role="status">{checkoutMessage}</p>}
        <p className="plans-note">Pro renews monthly at ₹500 through Razorpay. Contact Vista support for subscription changes or cancellation.</p>
      </div>
      </main>
    </div>
  )
}

export default PlansPage
