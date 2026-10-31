import assert from 'node:assert/strict'
import test from 'node:test'
import type { Request, Response } from 'express'
import { chatWithVee } from '../src/controllers/vee.controller.js'

test('Vee sends its project context and chat to Gemini using the Gemini API key', async () => {
  const originalFetch = globalThis.fetch
  const oldKey = process.env.GEMINI_API_KEY
  const oldModel = process.env.GEMINI_MODEL
  const oldFallback = process.env.GEMINI_FALLBACK_MODEL
  const primaryModel = 'test-primary-model'
  process.env.GEMINI_API_KEY = 'gemini-test-key'
  process.env.GEMINI_MODEL = primaryModel
  let capturedUrl = ''
  let capturedInit: RequestInit | undefined
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    capturedUrl = String(url)
    capturedInit = init
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'I can help with your Vista event.' }] } }] }), { status: 200 })
  }) as typeof fetch

  const output = { statusCode: 200, body: undefined as unknown, status(code: number) { this.statusCode = code; return this }, json(body: unknown) { this.body = body; return this } }
  try {
    await chatWithVee({ body: { message: 'How do I publish my event?', page: '/host-event', history: [] } } as Request, output as unknown as Response)
    assert.equal(capturedUrl, `https://generativelanguage.googleapis.com/v1beta/models/${primaryModel}:generateContent`)
    assert.equal(new Headers(capturedInit?.headers).get('x-goog-api-key'), 'gemini-test-key')
    assert.equal(new Headers(capturedInit?.headers).has('Authorization'), false)
    const requestBody = JSON.parse(String(capturedInit?.body)) as { systemInstruction: { parts: { text: string }[] }; contents: { role: string; parts: { text: string }[] }[] }
    assert.match(requestBody.systemInstruction.parts[0].text, /Vista's friendly/)
    assert.deepEqual(requestBody.contents, [{ role: 'user', parts: [{ text: 'How do I publish my event?' }] }])
    assert.deepEqual(output.body, { reply: 'I can help with your Vista event.' })
  } finally {
    globalThis.fetch = originalFetch
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = oldKey
    if (oldModel === undefined) delete process.env.GEMINI_MODEL
    else process.env.GEMINI_MODEL = oldModel
    if (oldFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL
    else process.env.GEMINI_FALLBACK_MODEL = oldFallback
  }
})

test('Vee retries a temporary primary model error with the fallback model', async () => {
  const originalFetch = globalThis.fetch
  const oldKey = process.env.GEMINI_API_KEY
  const oldModel = process.env.GEMINI_MODEL
  const oldFallback = process.env.GEMINI_FALLBACK_MODEL
  process.env.GEMINI_API_KEY = 'gemini-test-key'
  process.env.GEMINI_MODEL = 'test-primary-model'
  process.env.GEMINI_FALLBACK_MODEL = 'test-fallback-model'
  const requestedModels: string[] = []
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    requestedModels.push(String(url).split('/models/')[1].split(':')[0])
    if (requestedModels.length <= 3) return new Response(JSON.stringify({ error: { message: 'Temporary overload' } }), { status: 503 })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Vee is back.' }] } }] }), { status: 200 })
  }) as typeof fetch

  const output = { statusCode: 200, body: undefined as unknown, status(code: number) { this.statusCode = code; return this }, json(body: unknown) { this.body = body; return this } }
  try {
    await chatWithVee({ body: { message: 'Help me.', page: '/', history: [] } } as Request, output as unknown as Response)
    assert.deepEqual(requestedModels, ['test-primary-model', 'test-primary-model', 'test-primary-model', 'test-fallback-model'])
    assert.deepEqual(output.body, { reply: 'Vee is back.' })
  } finally {
    globalThis.fetch = originalFetch
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = oldKey
    if (oldModel === undefined) delete process.env.GEMINI_MODEL
    else process.env.GEMINI_MODEL = oldModel
    if (oldFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL
    else process.env.GEMINI_FALLBACK_MODEL = oldFallback
  }
})

test('Vee skips primary retries on a 404 and makes one fallback attempt', async () => {
  const originalFetch = globalThis.fetch
  const oldKey = process.env.GEMINI_API_KEY
  const oldModel = process.env.GEMINI_MODEL
  const oldFallback = process.env.GEMINI_FALLBACK_MODEL
  process.env.GEMINI_API_KEY = 'gemini-test-key'
  process.env.GEMINI_MODEL = 'missing-primary-model'
  process.env.GEMINI_FALLBACK_MODEL = 'available-fallback-model'
  const requestedModels: string[] = []
  globalThis.fetch = (async (url: RequestInfo | URL) => {
    const model = String(url).split('/models/')[1].split(':')[0]
    requestedModels.push(model)
    if (model === 'missing-primary-model') return new Response('{}', { status: 404 })
    return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Fallback works.' }] } }] }), { status: 200 })
  }) as typeof fetch
  const output = { statusCode: 200, body: undefined as unknown, status(code: number) { this.statusCode = code; return this }, json(body: unknown) { this.body = body; return this } }
  try {
    await chatWithVee({ body: { message: 'Help me.', page: '/', history: [] } } as Request, output as unknown as Response)
    assert.deepEqual(requestedModels, ['missing-primary-model', 'available-fallback-model'])
    assert.deepEqual(output.body, { reply: 'Fallback works.' })
  } finally {
    globalThis.fetch = originalFetch
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = oldKey
    if (oldModel === undefined) delete process.env.GEMINI_MODEL
    else process.env.GEMINI_MODEL = oldModel
    if (oldFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL
    else process.env.GEMINI_FALLBACK_MODEL = oldFallback
  }
})

test('Vee does not retry configuration errors and returns the friendly busy message', async () => {
  const originalFetch = globalThis.fetch
  const oldKey = process.env.GEMINI_API_KEY
  process.env.GEMINI_API_KEY = 'gemini-test-key'
  let calls = 0
  const oldModel = process.env.GEMINI_MODEL
  const oldFallback = process.env.GEMINI_FALLBACK_MODEL
  process.env.GEMINI_MODEL = 'test-primary-model'
  process.env.GEMINI_FALLBACK_MODEL = 'test-fallback-model'
  globalThis.fetch = (async () => {
    calls += 1
    return new Response(JSON.stringify({ error: { message: 'Invalid API key' } }), { status: 401 })
  }) as typeof fetch

  const output = { statusCode: 200, body: undefined as unknown, status(code: number) { this.statusCode = code; return this }, json(body: unknown) { this.body = body; return this } }
  try {
    await chatWithVee({ body: { message: 'Help me.', page: '/', history: [] } } as Request, output as unknown as Response)
    assert.equal(calls, 1)
    assert.equal(output.statusCode, 502)
    assert.deepEqual(output.body, { message: 'Vee is busy, please try again in a moment.' })
  } finally {
    globalThis.fetch = originalFetch
    if (oldKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = oldKey
    if (oldModel === undefined) delete process.env.GEMINI_MODEL
    else process.env.GEMINI_MODEL = oldModel
    if (oldFallback === undefined) delete process.env.GEMINI_FALLBACK_MODEL
    else process.env.GEMINI_FALLBACK_MODEL = oldFallback
  }
})
