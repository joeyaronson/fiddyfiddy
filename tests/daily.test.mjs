import assert from 'node:assert/strict'
import test from 'node:test'
import { createSeededRandom, getPuzzleDate, getPuzzleId } from '../src/lib/daily.ts'

test('the puzzle date uses UTC across timezones and midnight', () => {
  assert.equal(getPuzzleDate(new Date('2026-11-07T16:30:00-08:00')), '2026-11-08')
  assert.equal(getPuzzleDate(new Date('2026-11-07T23:59:59Z')), '2026-11-07')
  assert.equal(getPuzzleDate(new Date('2026-11-08T00:00:00Z')), '2026-11-08')
})

test('puzzle identity includes the generator version and date', () => {
  assert.equal(getPuzzleId('2026-11-07'), 'fiddyfiddy:v1:2026-11-07')
})

test('a daily seed reproduces its sequence and another day differs', () => {
  const sequence = (date) => {
    const random = createSeededRandom(getPuzzleId(date))
    return Array.from({ length: 100 }, random)
  }
  const today = sequence('2026-11-07')
  assert.deepEqual(today, sequence('2026-11-07'))
  assert.notDeepEqual(today, sequence('2026-11-08'))
  assert.ok(today.every((value) => value >= 0 && value < 1))
})
