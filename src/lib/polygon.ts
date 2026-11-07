export type Point = { x: number; y: number }

const turn = (a: Point, b: Point, c: Point) =>
  (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)

function intersects(a: Point, b: Point, c: Point, d: Point): boolean {
  return Math.max(a.x, b.x) >= Math.min(c.x, d.x) &&
    Math.max(c.x, d.x) >= Math.min(a.x, b.x) &&
    Math.max(a.y, b.y) >= Math.min(c.y, d.y) &&
    Math.max(c.y, d.y) >= Math.min(a.y, b.y) &&
    turn(a, b, c) * turn(a, b, d) <= 0 &&
    turn(c, d, a) * turn(c, d, b) <= 0
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const t = Math.max(0, Math.min(1,
    ((point.x - a.x) * dx + (point.y - a.y) * dy) / (dx * dx + dy * dy),
  ))
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy)
}

// Coordinates span roughly two units. Keep separate boundary sections at least
// this far apart, with extra room for rounding the corners during rendering.
export const MIN_OUTLINE_CLEARANCE = 0.22
const MIN_EDGE_LENGTH = 0.24
const MIN_CORNER_ANGLE = 55 * Math.PI / 180

type ShapeOptions = {
  clearance: number
  minimumEdge: number
  minimumAngle: number
  targetConcavity: number
  minimumBays: number
  maximumBays: number
}

function hasRoom(points: Point[], options: ShapeOptions): boolean {
  for (let i = 0; i < points.length; i++) {
    const a = points[i], b = points[(i + 1) % points.length]
    const previous = points[(i + points.length - 1) % points.length]
    const edgeLength = Math.hypot(b.x - a.x, b.y - a.y)
    const previousLength = Math.hypot(previous.x - a.x, previous.y - a.y)
    if (edgeLength < options.minimumEdge) return false
    const cosine = ((previous.x - a.x) * (b.x - a.x) +
      (previous.y - a.y) * (b.y - a.y)) / (edgeLength * previousLength)
    // Reject sharp tips as well as hairpin-shaped inward cuts.
    if (cosine > Math.cos(options.minimumAngle)) return false

    for (let j = i + 2; j < points.length; j++) {
      if (i === 0 && j === points.length - 1) continue
      const c = points[j], d = points[(j + 1) % points.length]
      if (intersects(a, b, c, d) || Math.min(
        distanceToSegment(a, c, d), distanceToSegment(b, c, d),
        distanceToSegment(c, a, b), distanceToSegment(d, a, b),
      ) < options.clearance) return false
    }
  }
  return true
}

function area(points: Point[]): number {
  return points.reduce((sum, a, i) => {
    const b = points[(i + 1) % points.length]
    return sum + a.x * b.y - b.x * a.y
  }, 0) / 2
}

function convexHull(points: Point[]): Point[] {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  const half = (vertices: Point[]) => {
    const result: Point[] = []
    for (const point of vertices) {
      while (result.length >= 2 &&
        turn(result[result.length - 2], result[result.length - 1], point) <= 0) result.pop()
      result.push(point)
    }
    return result.slice(0, -1)
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

export function measureShapeComplexity(points: Point[]) {
  const bays = points.filter((point, i) => turn(
    points[(i + points.length - 1) % points.length], point, points[(i + 1) % points.length],
  ) < -0.005).length
  // Missing area relative to the convex hull measures the depth of the bays,
  // rather than counting tiny dents as meaningful complexity.
  const concavity = 1 - area(points) / area(convexHull(points))
  return { bays, concavity }
}

function difficultyScore(points: Point[], options: ShapeOptions): number {
  const { bays, concavity } = measureShapeComplexity(points)
  return Math.abs(concavity - options.targetConcavity) +
    Math.max(0, options.minimumBays - bays, bays - options.maximumBays) * 0.12
}

// Start with a simple outline, then relocate vertices across angular sectors.
// Checking each move allows off-center bays and overhangs without crossing edges.
// Coordinates fit inside a unit circle, independent of rendering technology.
export function generatePolygon(
  sides: number,
  random: () => number,
  settings: Partial<ShapeOptions> = {},
): Point[] {
  if (!Number.isInteger(sides) || sides < 3 || sides > 100) {
    throw new RangeError('A polygon must have between 3 and 100 sides.')
  }

  const options: ShapeOptions = {
    clearance: MIN_OUTLINE_CLEARANCE,
    minimumEdge: MIN_EDGE_LENGTH,
    minimumAngle: MIN_CORNER_ANGLE,
    targetConcavity: 0.2,
    minimumBays: 2,
    maximumBays: 5,
    ...settings,
  }
  // More boundary samples must not force more narrow features into a fixed area.
  const corners = Math.min(sides, 22)
  const step = (Math.PI * 2) / corners
  const rotation = random() * Math.PI * 2
  const points = Array.from({ length: corners }, (_, index) => {
    const angle = rotation + index * step
    return { x: Math.cos(angle) * 0.9, y: Math.sin(angle) * 0.9 }
  })

  let best = [...points]
  let bestScore = difficultyScore(points, options)
  for (let attempt = 0; attempt < corners * 250; attempt++) {
    const index = Math.floor(random() * corners)
    const angle = random() * Math.PI * 2
    const distance = 0.08 + random() * 0.35
    const original = points[index]
    const candidate = {
      x: original.x + Math.cos(angle) * distance,
      y: original.y + Math.sin(angle) * distance,
    }
    if (Math.hypot(candidate.x, candidate.y) > 1) continue
    points[index] = candidate
    if (!hasRoom(points, options) || area(points) < 0.6) {
      points[index] = original
      continue
    }
    const score = difficultyScore(points, options)
    if (score <= bestScore) {
      bestScore = score
      best = [...points]
    }
  }

  points.splice(0, points.length, ...best)

  // Distribute extra samples along existing edges instead of adding more cuts.
  const divisions = Array<number>(corners).fill(1)
  const lengths = points.map((a, i) => {
    const b = points[(i + 1) % corners]
    return Math.hypot(b.x - a.x, b.y - a.y)
  })
  for (let count = corners; count < sides; count++) {
    let longest = 0
    for (let i = 1; i < corners; i++) {
      if (lengths[i] / divisions[i] > lengths[longest] / divisions[longest]) longest = i
    }
    divisions[longest]++
  }
  return points.flatMap((a, i) => {
    const b = points[(i + 1) % corners]
    return Array.from({ length: divisions[i] }, (_, j) => {
      const t = j / divisions[i]
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
    })
  })
}
