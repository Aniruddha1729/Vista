import assert from 'node:assert/strict'
import test from 'node:test'
import type { Request, Response } from 'express'
import { chatWithVee } from '../src/controllers/vee.controller.js'

test('Vee sends its project context and chat to Gemini using the Gemini API key', async () => {
  const originalFetch = globalThis.fetch
  const oldKey = process.env.GEMINI_API_KEY
  const oldModel = process.env.GEMINI_MODEL
  process.env.GEMINI_API_KEY = 'gemini-test-key'
  process.env.GEMINI_MODEL = 'gemini-3.8-flash'
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
    assert.equal(capturedUrl, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent')
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
  }
})
