import { measureCut } from './cut'
import type { SubmittedCut } from './cut'

export const CHOP_DURATION = 1870

export function layoutCut(cut: SubmittedCut) {
  const pieces = measureCut(cut).map((piece) => {
    const xs = piece.outline.map(({ x }) => x)
    const ys = piece.outline.map(({ y }) => y)
    const left = Math.min(...xs), right = Math.max(...xs)
    const top = Math.min(...ys), bottom = Math.max(...ys)
    return { ...piece, left, right, top, bottom,
      centerX: (left + right) / 2, centerY: (top + bottom) / 2 }
  }).sort((a, b) => Math.abs(a.centerX - b.centerX) > 0.08 ?
    a.centerX - b.centerX : a.top - b.top)

  // Both pieces use the same scale, preserving their relative sizes.
  const scale = Math.min(1,
    0.4 / Math.max(...pieces.map((piece) => piece.right - piece.left)),
    0.56 / Math.max(...pieces.map((piece) => piece.bottom - piece.top)),
  )
  return pieces.map((piece, index) => ({
    ...piece, scale, targetX: index === 0 ? 0.26 : 0.74, targetY: 0.59,
  }))
}
