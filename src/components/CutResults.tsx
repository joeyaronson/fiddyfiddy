import { useEffect, useMemo, useState } from 'react'
import { cutHalfPlane, polygonArea } from '../lib/cut'
import type { SubmittedCut } from '../lib/cut'
import { CHOP_DURATION, layoutCut } from '../lib/cutLayout'
import { PerfectCut } from './PerfectCut'

const FILL_DURATION = 1150
const PAUSE = 250
const TOTAL_DURATION = CHOP_DURATION + FILL_DURATION * 2 + PAUSE

export function CutResults({ cut, onComplete, onPerfect, instant = false }: {
  cut: SubmittedCut
  onComplete: () => void
  onPerfect: () => void
  instant?: boolean
}) {
  const [elapsed, setElapsed] = useState(instant ? TOTAL_DURATION : 0)
  const pieces = useMemo(() => layoutCut(cut), [cut])
  const perfect = pieces.every((piece) => piece.percentage === 50)

  useEffect(() => {
    let start: number | null = null
    let frame: number
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const tick = (time: number) => {
      start ??= time
      const next = instant || reducedMotion ? TOTAL_DURATION : Math.min(time - start, TOTAL_DURATION)
      setElapsed(next)
      if (next < TOTAL_DURATION) frame = requestAnimationFrame(tick)
      else {
        if (perfect && !instant) onPerfect()
        onComplete()
      }
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [cut, onComplete, onPerfect, perfect, instant])

  const finished = elapsed >= TOTAL_DURATION
  const revealed = pieces.map((piece, index) => {
    const progress = Math.max(0, Math.min(1,
      (elapsed - CHOP_DURATION - index * (FILL_DURATION + PAUSE)) / FILL_DURATION,
    ))
    const waterline = piece.bottom - (piece.bottom - piece.top) * progress
    // Measure the area below the moving waterline so the counter tracks how
    // much of the piece has actually filled, rather than just its height.
    const filled = cutHalfPlane({ start: { x: 0, y: waterline }, end: { x: 1, y: waterline } }, 1, piece.outline)
    const fraction = piece.area > 0 ? Math.min(1, polygonArea(filled) / piece.area) : 0
    return { ...piece, progress, filled, count: progress === 1 ? piece.percentage : piece.percentage * fraction }
  })

  return (
    <>
      <svg className="measurement-fill" viewBox="0 0 1000 1000" preserveAspectRatio="none" aria-hidden="true">
        {revealed.map((piece, index) => piece.progress > 0 && (
          <polygon key={piece.side}
            points={piece.filled.map(({ x, y }) =>
              `${(piece.targetX + (x - piece.centerX) * piece.scale) * 1000},${(piece.targetY + (y - piece.centerY) * piece.scale) * 1000}`,
            ).join(' ')}
            fill={index === 0 ? 'var(--piece-a)' : 'var(--piece-b)'}
            stroke="var(--ink)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {revealed.map((piece, index) => (
        <div key={piece.side} className={`piece-percentage piece-percentage-${index}`}
          style={{ left: `${piece.targetX * 100}%`, top: '21%',
            visibility: piece.progress > 0 ? 'visible' : 'hidden' }} aria-hidden="true">
          {piece.count.toFixed(1)}<span>%</span>
        </div>
      ))}
      {finished && perfect && !instant && <PerfectCut />}
      <span className="sr-only" role="status">
        {finished ? perfect ? 'Perfect 50/50 split. 1,000 points.' :
          `Area split: ${pieces[0].percentage.toFixed(1)} percent and ${pieces[1].percentage.toFixed(1)} percent.` :
          elapsed < CHOP_DURATION ? 'Chopping the shape.' :
            elapsed < CHOP_DURATION + FILL_DURATION + PAUSE ? 'Measuring the first piece.' : 'Measuring the second piece.'}
      </span>
    </>
  )
}
