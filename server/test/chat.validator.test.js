import test from 'node:test'
import assert from 'node:assert/strict'
import { createMessageSchema } from '../src/validators/chat.validator.js'

test('chat message schema trims valid content and accepts an optional retry identifier', () => {
  const result = createMessageSchema.safeParse({ content: '  Hello there  ', clientMessageId: 'retry-1' })
  assert.equal(result.success, true)
  assert.equal(result.data.content, 'Hello there')
  assert.equal(result.data.clientMessageId, 'retry-1')
})

test('chat message schema rejects empty or overlong content', () => {
  assert.equal(createMessageSchema.safeParse({ content: '   ' }).success, false)
  assert.equal(createMessageSchema.safeParse({ content: 'x'.repeat(2001) }).success, false)
})

test('chat message schema rejects client-supplied sender and unknown fields', () => {
  assert.equal(createMessageSchema.safeParse({ content: 'Hello', sender: 'someone-else' }).success, false)
})
