import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import test from 'node:test'

test('Razorpay webhook route is mounted with raw body parsing and rejects unsigned requests', async () => {
  process.env.NODE_ENV = 'test'
  process.env.CLIENT_URL = 'http://localhost:5173'
  process.env.RAZORPAY_WEBHOOK_SECRET = 'webhook-route-test-secret'
  const { default: app } = await import('../src/app.js')
  const layers = (app as unknown as { router: { stack: Array<{ route?: { path: string; stack: Array<{ name: string; handle: (request: unknown, response: unknown) => unknown }> } }> } }).router.stack
  const webhookLayer = layers.find((layer) => layer.route?.path === '/api/webhooks/razorpay')
  assert.ok(webhookLayer?.route)
  assert.deepEqual(webhookLayer.route.stack.map((handler) => handler.name), ['rawParser', 'razorpayWebhook'])
  const webhook = webhookLayer.route.stack[1].handle
  const rawBody = Buffer.from('{"event":"payment.captured","payload":{}}')
  const reply = () => ({ statusCode: 200, payload: undefined as unknown, status(code: number) { this.statusCode = code; return this }, json(payload: unknown) { this.payload = payload; return this } })

  const unsignedResponse = reply()
  await webhook({ body: rawBody, get: () => '' }, unsignedResponse)
  assert.equal(unsignedResponse.statusCode, 400)

  const signature = createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex')
  const signedResponse = reply()
  await webhook({ body: rawBody, get: () => signature }, signedResponse)
  assert.equal(signedResponse.statusCode, 200)
  assert.deepEqual(signedResponse.payload, { received: true })
})
