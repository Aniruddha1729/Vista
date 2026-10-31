import assert from 'node:assert/strict'
import test from 'node:test'
import { eventHasRoomFilter } from '../src/utils/capacity.js'

test('capacity reservation targets a published event with a place remaining', () => {
  assert.deepEqual(eventHasRoomFilter('event-123'), {
    _id: 'event-123',
    status: 'published',
    $expr: { $lt: ['$registeredCount', '$capacity'] },
  })
})
