import type { Point } from './polygon'

export type Cut = { start: Point; end: Point }
export type SubmittedCut = Cut & { outline: Point[]; aspect: number }

export function fitSubmittedCut(cut: SubmittedCut, aspect: number): SubmittedCut {
  if (Math.abs(cut.aspect - aspect) < 1e-8) return cut
  const scale = Math.min(aspect, 1) / Math.min(cut.aspect, 1)
  const fit = ({ x, y }: Point): Point => ({
    x: 0.5 + (x - 0.5) * cut.aspect / aspect * scale,
    y: 0.5 + (y - 0.5) * scale,
  })
  return { ...cut, start: fit(cut.start), end: fit(cut.end), outline: cut.outline.map(fit), aspect }
}
const EPSILON = 1e-7
const cross = (a: Point, b: Point) => a.x * b.y - a.y * b.x
const subtract = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y })

// Clip an outline to either side of a line; default to the stage rectangle.
export function cutHalfPlane(cut: Cut, side: number, outline: Point[] = [
  { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
]): Point[] {
  const direction = subtract(cut.end, cut.start)
  const distance = (point: Point) => cross(direction, subtract(point, cut.start)) * side
  const result: Point[] = []
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length]
    const da = distance(a), db = distance(b)
    if (da >= 0) result.push(a)
    if ((da >= 0) !== (db >= 0)) {
      const t = da / (da - db)
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t })
    }
  }
  return result
}

export function polygonArea(outline: Point[]): number {
  return Math.abs(outline.reduce((sum, a, i) => {
    const b = outline[(i + 1) % outline.length]
    return sum + a.x * b.y - b.x * a.y
  }, 0)) / 2
}

export function measureCut(cut: SubmittedCut) {
  const split = splitShape(cut, cut.outline)
  if (!split) throw new Error('The cut must separate the shape into two pieces.')
  const pieces = split.map(({ side, outline }) => {
    return { side, outline, area: polygonArea(outline) }
  })
  const total = pieces[0].area + pieces[1].area
  const first = total > 0 ? Math.round(pieces[0].area / total * 1000) / 10 : 0
  return pieces.map((piece, index) => ({
    ...piece, percentage: index === 0 ? first : Math.round((100 - first) * 10) / 10,
  }))
}

function location(point: Point, outline: Point[]): 'inside' | 'outside' | 'boundary' {
  let inside = false
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length]
    const edge = subtract(b, a), offset = subtract(point, a)
    const lengthSquared = edge.x * edge.x + edge.y * edge.y
    if (lengthSquared < EPSILON * EPSILON) continue
    const t = (offset.x * edge.x + offset.y * edge.y) / lengthSquared
    if (t >= 0 && t <= 1 && Math.abs(cross(edge, offset)) < EPSILON * Math.sqrt(lengthSquared)) {
      return 'boundary'
    }
    if ((a.y > point.y) !== (b.y > point.y) &&
      point.x < a.x + (point.y - a.y) * (b.x - a.x) / (b.y - a.y)) inside = !inside
  }
  return inside ? 'inside' : 'outside'
}

// Follow the actual boundary between the two crossings of the finite stroke.
// The rest of a concave shape can lie on either side of the extended line and
// must stay attached to its piece rather than being clipped by a half-plane.
function splitShape(cut: Cut, source: Point[]) {
  const outline = source.filter((point, i) => {
    const next = source[(i + 1) % source.length]
    return Math.hypot(next.x - point.x, next.y - point.y) > EPSILON
  })
  if (outline.length < 3 || location(cut.start, outline) === 'inside' ||
    location(cut.end, outline) === 'inside') return null
  const direction = subtract(cut.end, cut.start)
  if (Math.hypot(direction.x, direction.y) < EPSILON) return null
  const crossings: { t: number; position: number; point: Point }[] = []
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i], b = outline[(i + 1) % outline.length]
    const edge = subtract(b, a), offset = subtract(a, cut.start)
    const denominator = cross(direction, edge)
    if (Math.abs(denominator) < EPSILON * EPSILON) continue
    const t = cross(offset, edge) / denominator
    const u = cross(offset, direction) / denominator
    if (t >= -EPSILON && t <= 1 + EPSILON && u >= -EPSILON && u <= 1 + EPSILON) {
      const parameter = Math.max(0, Math.min(1, t))
      crossings.push({
        t: parameter,
        position: (i + Math.max(0, Math.min(1, u))) % outline.length,
        point: { x: cut.start.x + direction.x * parameter, y: cut.start.y + direction.y * parameter },
      })
    }
  }
  crossings.sort((a, b) => a.t - b.t)
  const unique = crossings.filter((hit, i) => i === 0 || hit.t - crossings[i - 1].t > EPSILON)
  const intervals: [typeof unique[number], typeof unique[number]][] = []
  for (let i = 1; i < unique.length; i++) {
    const t = (unique[i].t + unique[i - 1].t) / 2
    if (location({ x: cut.start.x + direction.x * t, y: cut.start.y + direction.y * t }, outline) === 'inside') {
      intervals.push([unique[i - 1], unique[i]])
    }
  }
  // Crossing several separate lobes produces more than two physical pieces.
  if (intervals.length !== 1) return null
  const [entry, exit] = intervals[0]
  const walk = (from: typeof entry, to: typeof entry): Point[] => {
    const span = (to.position - from.position + outline.length) % outline.length
    const vertices = outline.map((point, index) => ({
      point, distance: (index - from.position + outline.length) % outline.length,
    })).filter(({ distance }) => distance > EPSILON && distance < span - EPSILON)
      .sort((a, b) => a.distance - b.distance)
    return [from.point, ...vertices.map(({ point }) => point), to.point]
  }
  const winding = outline.reduce((sum, point, i) =>
    sum + cross(point, outline[(i + 1) % outline.length]), 0) > 0 ? 1 : -1
  const pieces = [
    { side: -winding, outline: walk(entry, exit) },
    { side: winding, outline: walk(exit, entry) },
  ]
  return pieces.every((piece) => polygonArea(piece.outline) > EPSILON * EPSILON) ? pieces : null
}

export function splitsShape(cut: Cut, outline: Point[]): boolean {
  return splitShape(cut, outline) !== null
}
