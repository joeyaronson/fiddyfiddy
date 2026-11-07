import assert from 'node:assert/strict'
import test from 'node:test'
import { createSeededRandom } from '../src/lib/daily.ts'
import { generatePolygon } from '../src/lib/polygon.ts'

test('polygons have N distinct vertices, stay in bounds, and have positive area', () => {
  for (let sides = 3; sides <= 100; sides++) {
    for (let seed = 0; seed < 20; seed++) {
      const points = generatePolygon(sides, createSeededRandom(`${sides}:${seed}`))
      assert.equal(points.length, sides)
      assert.equal(new Set(points.map(({ x, y }) => `${x},${y}`)).size, sides)
      assert.ok(points.every(({ x, y }) => Math.hypot(x, y) <= 1.0000001))
      const area = points.reduce((sum, a, i) => {
        const b = points[(i + 1) % sides]
        return sum + a.x * b.y - b.x * a.y
      }, 0) / 2
      assert.ok(area > 0)
    }
  }
})

test('the same seed reproduces the same polygon', () => {
  assert.deepEqual(
    generatePolygon(7, createSeededRandom('daily')),
    generatePolygon(7, createSeededRandom('daily')),
  )
})

test('higher side counts have multiple concave regions without crossing edges', () => {
  const turn = (a, b, c) =>
    (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

  for (const sides of [12, 20, 50, 100]) {
    for (let seed = 0; seed < 100; seed++) {
      const points = generatePolygon(sides, createSeededRandom(`concave:${seed}`))
      const concave = points.filter((point, i) =>
        turn(points[(i + sides - 1) % sides], point, points[(i + 1) % sides]) < 0,
      )
      assert.ok(concave.length >= Math.floor(sides / 4))

      for (let i = 0; i < sides; i++) {
        for (let j = i + 2; j < sides; j++) {
          if (i === 0 && j === sides - 1) continue
          const a = points[i], b = points[(i + 1) % sides]
          const c = points[j], d = points[(j + 1) % sides]
          assert.ok(!(turn(a, b, c) * turn(a, b, d) < 0 &&
            turn(c, d, a) * turn(c, d, b) < 0), 'edges must not cross')
        }
      }
    }
  }
})

test('invalid side counts are rejected', () => {
  for (const sides of [0, 2, 3.5, 101, NaN, Infinity]) {
    assert.throws(() => generatePolygon(sides, () => 0.5), RangeError)
  }
})
