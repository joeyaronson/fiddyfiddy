import type { Point } from './polygon'

export type RoundedCorner = { start: Point; control: Point; end: Point }

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
    ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared,
  ))
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy)
}

// Quadratic Béziers replace the corners. Limit their reach near other edges
// so rounding a narrow bay cannot cut across a different part of the outline.
export function roundOutline(points: Point[]): RoundedCorner[] {
  // Extra samples on straight edges should not reduce the corner rounding.
  points = points.filter((point, i) => {
    const previous = points[(i + points.length - 1) % points.length]
    const next = points[(i + 1) % points.length]
    const cross = (point.x - previous.x) * (next.y - point.y) -
      (point.y - previous.y) * (next.x - point.x)
    return Math.abs(cross) > 1e-10
  })
  return points.map((control, index) => {
    const previous = points[(index + points.length - 1) % points.length]
    const next = points[(index + 1) % points.length]
    const incoming = Math.hypot(previous.x - control.x, previous.y - control.y)
    const outgoing = Math.hypot(next.x - control.x, next.y - control.y)
    let clearance = Infinity
    for (let edge = 0; edge < points.length; edge++) {
      const end = (edge + 1) % points.length
      if (edge === index || end === index) continue
      clearance = Math.min(clearance, distanceToSegment(control, points[edge], points[end]))
    }
    const toward = (point: Point, length: number): Point => {
      const fraction = length === 0 ? 0 : Math.min(0.49, clearance * 0.45 / length)
      return {
        x: control.x + (point.x - control.x) * fraction,
        y: control.y + (point.y - control.y) * fraction,
      }
    }
    return { start: toward(previous, incoming), control, end: toward(next, outgoing) }
  })
}
