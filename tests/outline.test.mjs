import assert from 'node:assert/strict'
import test from 'node:test'
import { createSeededRandom } from '../src/lib/daily.ts'
import { generatePolygon } from '../src/lib/polygon.ts'
import { roundOutline } from '../src/lib/outline.ts'

test('rounded outlines stay in bounds and retain positive area without crossing', () => {
  const turn = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

  for (const sides of [3, 5, 12, 20, 100]) {
    for (let seed = 0; seed < 10; seed++) {
      const corners = roundOutline(generatePolygon(sides, createSeededRandom(`curves:${seed}`)))
      const samples = corners.flatMap(({ start, control, end }) =>
        Array.from({ length: 13 }, (_, i) => {
          const t = i / 12, u = 1 - t
          return {
            x: u * u * start.x + 2 * u * t * control.x + t * t * end.x,
            y: u * u * start.y + 2 * u * t * control.y + t * t * end.y,
          }
        }),
      )
      assert.ok(samples.every(({ x, y }) => Math.hypot(x, y) <= 1.0000001))
      assert.ok(samples.reduce((sum, a, i) => {
        const b = samples[(i + 1) % samples.length]
        return sum + a.x * b.y - b.x * a.y
      }, 0) > 0)

      for (let i = 0; i < samples.length; i++) {
        for (let j = i + 2; j < samples.length; j++) {
          if (i === 0 && j === samples.length - 1) continue
          const a = samples[i], b = samples[(i + 1) % samples.length]
          const c = samples[j], d = samples[(j + 1) % samples.length]
          assert.ok(!(turn(a, b, c) * turn(a, b, d) < 0 &&
            turn(c, d, a) * turn(c, d, b) < 0), 'rounded edges must not cross')
        }
      }
    }
  }
})
