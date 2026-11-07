import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import type { Point } from '../lib/polygon'
import { PolygonScene } from './PolygonScene'
import { splitsShape } from '../lib/cut'
import type { Cut, SubmittedCut } from '../lib/cut'
import { scoreCut } from '../lib/scoring'

type Drag = { pointerId: number; start: Point; previousCut: Cut | null }

const clamp = (value: number) => Math.max(0, Math.min(1, value))

export function CuttableShape({ points, submittedCut, onSubmit, resultsReady, lastLevel,
  onResultsComplete, onNextLevel }: {
  points: Point[]
  submittedCut: SubmittedCut | null
  onSubmit: (cut: SubmittedCut) => void
  resultsReady: boolean
  lastLevel: boolean
  onResultsComplete: () => void
  onNextLevel: () => void
}) {
  // Fractions of the stage keep the line in place when the viewport resizes.
  const [draftCut, setCut] = useState<Cut | null>(null)
  const cut = submittedCut ?? draftCut
  const [dragging, setDragging] = useState(false)
  const [shapeReady, setShapeReady] = useState(false)
  const onShapeReady = useCallback(() => setShapeReady(true), [])
  const submitted = submittedCut !== null
  const [skipAnimations] = useState(submitted)
  const [boundary, setBoundary] = useState<Point[]>([])
  const drag = useRef<Drag | null>(null)
  const latestCut = useRef<Cut | null>(null)
  const surface = useRef<SVGSVGElement>(null)
  const validCut = cut !== null && splitsShape(cut, boundary)

  const submit = () => {
    if (shapeReady && !submitted && cut && !drag.current && splitsShape(cut, boundary)) {
      const bounds = surface.current!.getBoundingClientRect()
      onSubmit({ ...cut, outline: boundary, aspect: bounds.width / bounds.height })
    }
  }

  useEffect(() => {
    const element = surface.current
    if (!element) return
    // Native, explicitly non-passive listeners can cancel browser gestures.
    // Touch events remain targeted here when a finger moves outside the stage.
    const preventGesture = (event: TouchEvent) => {
      if (event.cancelable) event.preventDefault()
    }
    element.addEventListener('touchstart', preventGesture, { passive: false })
    element.addEventListener('touchmove', preventGesture, { passive: false })
    return () => {
      element.removeEventListener('touchstart', preventGesture)
      element.removeEventListener('touchmove', preventGesture)
    }
  }, [])

  const placeCut = (value: Cut | null) => {
    latestCut.current = value
    setCut(value)
  }

  const position = (event: PointerEvent<SVGSVGElement>): Point => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return {
      x: clamp((event.clientX - bounds.left) / bounds.width),
      y: clamp((event.clientY - bounds.top) / bounds.height),
    }
  }

  const begin = (event: PointerEvent<SVGSVGElement>) => {
    if (!shapeReady || submitted || !event.isPrimary || event.button !== 0 || drag.current) return
    event.preventDefault()
    const start = position(event)
    drag.current = { pointerId: event.pointerId, start, previousCut: latestCut.current }
    event.currentTarget.setPointerCapture(event.pointerId)
    event.currentTarget.focus({ preventScroll: true })
    setDragging(true)
    placeCut({ start, end: start })
  }

  const move = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerId !== drag.current?.pointerId) return
    event.preventDefault()
    placeCut({ start: drag.current.start, end: position(event) })
  }

  const finish = (event: PointerEvent<SVGSVGElement>) => {
    const active = drag.current
    if (!active || event.pointerId !== active.pointerId) return
    event.preventDefault()
    const end = position(event)
    const bounds = event.currentTarget.getBoundingClientRect()
    const length = Math.hypot(
      (end.x - active.start.x) * bounds.width,
      (end.y - active.start.y) * bounds.height,
    )
    // A tap or an accidental tiny drag keeps the previous placement.
    placeCut(length >= 24 ? { start: active.start, end } : active.previousCut)
    drag.current = null
    setDragging(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  const cancel = (event: PointerEvent<SVGSVGElement>) => {
    if (event.pointerId !== drag.current?.pointerId) return
    placeCut(drag.current.previousCut)
    drag.current = null
    setDragging(false)
  }

  const reset = () => {
    if (submitted) return
    drag.current = null
    placeCut(null)
    setDragging(false)
  }

  const keyboard = (event: KeyboardEvent<SVGSVGElement>) => {
    if (!shapeReady || drag.current) return
    if (event.key === 'Escape') {
      event.preventDefault()
      reset()
      return
    }
    if (submitted) return
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (cut) submit()
      else placeCut({ start: { x: 0.05, y: 0.5 }, end: { x: 0.95, y: 0.5 } })
      return
    }
    if (!event.key.startsWith('Arrow')) return
    event.preventDefault()
    const current = cut ?? { start: { x: 0.05, y: 0.5 }, end: { x: 0.95, y: 0.5 } }
    const amount = event.shiftKey ? 0.05 : 0.01
    const dx = event.key === 'ArrowLeft' ? -amount : event.key === 'ArrowRight' ? amount : 0
    const dy = event.key === 'ArrowUp' ? -amount : event.key === 'ArrowDown' ? amount : 0
    // Left/right rotate the line; up/down move it across the shape.
    placeCut({
      start: { x: current.start.x, y: clamp(current.start.y + dy - dx) },
      end: { x: current.end.x, y: clamp(current.end.y + dy + dx) },
    })
  }

  const score = submittedCut && resultsReady ? scoreCut(submittedCut) : null
  const message = !shapeReady ? 'Wait for the shape to stop.' : submitted ? score ?
    `${score.emoji} ${score.points.toLocaleString('en-US')} / 1,000 points` :
    'Measuring areas…' : dragging ? 'Release to place your cut.' :
    cut ? validCut ? 'Redraw, reset, or submit your cut.' :
      'Cut through one section, from outside to outside. Drag again to redraw.' :
      'Drag a line through the shape, starting and ending outside, the goal is to get exactly 50/50.'

  return (
    <div className="cut-interaction">
      <div className={`cut-stage${submitted ? ' is-submitted' : ''}${!shapeReady ? ' is-entering' : ''}`}>
        <PolygonScene points={points} onBoundaryChange={setBoundary} submittedCut={submittedCut}
          onResultsComplete={onResultsComplete} onReady={onShapeReady} ready={shapeReady} skipAnimations={skipAnimations} />
        <svg ref={surface} className="cut-overlay" tabIndex={shapeReady ? 0 : -1} role="group" aria-label="Place your cut"
          aria-disabled={!shapeReady || submitted}
          aria-describedby="cut-keyboard-help" onPointerDown={begin} onPointerMove={move}
          onPointerUp={finish} onPointerCancel={cancel} onLostPointerCapture={cancel}
          onKeyDown={keyboard} onContextMenu={(event) => event.preventDefault()}
          onDragStart={(event) => event.preventDefault()}>
          {cut && (
            <g aria-hidden="true">
              <line className="cut-line-halo" x1={`${cut.start.x * 100}%`} y1={`${cut.start.y * 100}%`}
                x2={`${cut.end.x * 100}%`} y2={`${cut.end.y * 100}%`} />
              <line className="cut-line" x1={`${cut.start.x * 100}%`} y1={`${cut.start.y * 100}%`}
                x2={`${cut.end.x * 100}%`} y2={`${cut.end.y * 100}%`} />
              {submitted && !skipAnimations && (
                <line className="cut-slash" pathLength="1"
                  x1={`${cut.start.x * 100}%`} y1={`${cut.start.y * 100}%`}
                  x2={`${cut.end.x * 100}%`} y2={`${cut.end.y * 100}%`} />
              )}
              {[cut.start, cut.end].map((point, index) => (
                <circle key={index} className="cut-endpoint" cx={`${point.x * 100}%`}
                  cy={`${point.y * 100}%`} r="5" />
              ))}
            </g>
          )}
        </svg>
      </div>
      <p className={`cut-instruction${score?.error === 0 ? ' is-perfect' : ''}`} role="status">{message}</p>
      <span id="cut-keyboard-help" className="sr-only">
        Enter places a horizontal cut. Up and down move it; left and right rotate it.
        Hold Shift for larger adjustments. Enter submits; Escape resets.
      </span>
      <div className={`cut-actions${!cut || dragging || (submitted && !resultsReady) ? ' is-hidden' : ''}`}>
        {submitted ? (
          <button type="button" className="cut-submit cut-next" disabled={!resultsReady}
            onClick={onNextLevel}>{lastLevel ? 'View results' : 'Next level'}</button>
        ) : (
          <>
            <button type="button" className="cut-reset" disabled={!cut || dragging} onClick={reset}>Reset</button>
            <button type="button" className="cut-submit" disabled={!validCut || dragging}
              onClick={submit}>Submit</button>
          </>
        )}
      </div>
    </div>
  )
}
