import { createSeededRandom } from './daily'
import { generatePolygon } from './polygon'

export const DAILY_LEVELS = [
  { name: 'Easy', corners: 5,
    clearance: 0.24, minimumEdge: 0.24, angle: 70, concavity: 0, bays: 0, maximumBays: 0 },
  { name: 'Tricky', corners: 8,
    clearance: 0.2, minimumEdge: 0.22, angle: 60, concavity: 0.08, bays: 1, maximumBays: 2 },
  { name: 'Hard', corners: 12,
    clearance: 0.17, minimumEdge: 0.19, angle: 52, concavity: 0.2, bays: 2, maximumBays: 4 },
  { name: 'Expert', corners: 16,
    clearance: 0.14, minimumEdge: 0.17, angle: 45, concavity: 0.32, bays: 3, maximumBays: 6 },
  { name: 'Extreme', corners: 22,
    clearance: 0.12, minimumEdge: 0.15, angle: 40, concavity: 0.44, bays: 5, maximumBays: 9 },
] as const

export function generateDailyShape(puzzleId: string, level: number) {
  const profile = DAILY_LEVELS[level]
  if (!profile) throw new RangeError('Choose a daily level from 0 to 4.')
  return generatePolygon(profile.corners, createSeededRandom(`${puzzleId}:shapes-v2:${level}`), {
    clearance: profile.clearance,
    minimumEdge: profile.minimumEdge,
    minimumAngle: profile.angle * Math.PI / 180,
    targetConcavity: profile.concavity,
    minimumBays: profile.bays,
    maximumBays: profile.maximumBays,
  })
}
