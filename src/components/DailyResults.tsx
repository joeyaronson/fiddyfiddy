import { useEffect, useMemo, useRef, useState } from 'react'
import { DAILY_LEVELS } from '../lib/dailyShapes'
import { layoutCut } from '../lib/cutLayout'
import type { SubmittedCut } from '../lib/cut'
import { CUT_RATINGS, SCORE_EXPONENT, scoreCut, shareResults } from '../lib/scoring'
import { getDailyPalettes, paletteStyle } from '../lib/dailyColors'
import { copyText } from '../lib/clipboard'

function ResultShape({ cut, name }: { cut: SubmittedCut; name: string }) {
  const pieces = layoutCut(cut)
  // Preserve the submission viewport's aspect ratio so thumbnails retain the
  // shape's proportions even when the player cut on a wide or narrow screen.
  const xs = cut.outline.map(({ x }) => x * cut.aspect * 1000)
  const ys = cut.outline.map(({ y }) => y * 1000)
  const left = Math.min(...xs), top = Math.min(...ys)
  const width = Math.max(...xs) - left, height = Math.max(...ys) - top
  const padding = Math.max(width, height) * 0.1

  return (
    <svg className="result-shape" viewBox={`${left - padding} ${top - padding} ${width + padding * 2} ${height + padding * 2}`}
      role="img" aria-label={`${name} shape showing your cut`}>
      {pieces.map((piece, index) => (
        <polygon key={piece.side}
          points={piece.outline.map(({ x, y }) => `${x * cut.aspect * 1000},${y * 1000}`).join(' ')}
          fill={index === 0 ? 'var(--piece-a)' : 'var(--piece-b)'} stroke="var(--ink)" strokeWidth="1.5"
          strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  )
}

export function DailyResults({ submissions, date }: { submissions: SubmittedCut[]; date: string }) {
  const palettes = useMemo(() => getDailyPalettes(date), [date])
  const heading = useRef<HTMLHeadingElement>(null)
  const copyField = useRef<HTMLTextAreaElement>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [copied, setCopied] = useState(false)
  const [shareStatus, setShareStatus] = useState('')
  const [manualCopy, setManualCopy] = useState(false)
  const [sharing, setSharing] = useState(false)
  const scores = submissions.map(scoreCut)
  const total = scores.reduce((sum, score) => sum + score.points, 0)
  const shareText = shareResults(date, scores)

  const copy = async () => {
    const copied = await copyText(shareText)
    if (copied) {
      setCopied(true)
      if (copyTimer.current !== null) clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => {
        setCopied(false)
        copyTimer.current = null
      }, 4000)
      setShareStatus('')
    } else {
      setManualCopy(true)
      setShareStatus('Select and copy your results below.')
      copyField.current?.focus()
      copyField.current?.select()
    }
  }

  const share = async () => {
    if (sharing) return
    setSharing(true)
    setShareStatus('')
    try {
      await navigator.share({ title: 'fiddyfiddy results', text: shareText })
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) await copy()
    } finally {
      setSharing(false)
    }
  }
  useEffect(() => {
    return () => {
      if (copyTimer.current !== null) clearTimeout(copyTimer.current)
    }
  }, [])

  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [])

  useEffect(() => {
    if (manualCopy) {
      copyField.current?.focus()
      copyField.current?.select()
    }
  }, [manualCopy])

  return (
    <>
      <h1 ref={heading} tabIndex={-1} className="results-title">Results</h1>
      <section className="score-summary" aria-label="Daily score">
        <span className="score-eyebrow">Daily score</span>
        <p className="score-total">{total.toLocaleString('en-US')} <span>/ 5,000</span></p>
        <div className="score-emojis">
          {scores.map((score, index) => (
            <span key={index} role="img" aria-label={`Level ${index + 1}: ${score.name}`}>{score.emoji}</span>
          ))}
        </div>
        <div className="share-actions">
          {typeof navigator.share === 'function' && (
            <button type="button" onClick={share} disabled={sharing}>{sharing ? 'Sharing…' : 'Share results'}</button>
          )}
          <button type="button" onClick={copy}>{copied ? 'Copied' : 'Copy results'}</button>
        </div>
        <p className="share-status" role="status">{shareStatus}</p>
        <details className="share-preview" open={manualCopy || undefined}>
          <summary>Share text</summary>
          <textarea ref={copyField} readOnly value={shareText} rows={10} aria-label="Shareable results"
            onFocus={(event) => event.currentTarget.select()} />
        </details>
      </section>
      <ol className="daily-results" aria-label="Results for all five levels">
        {DAILY_LEVELS.map((level, index) => {
          const cut = submissions[index]
          const pieces = layoutCut(cut)
          return (
            <li key={level.name} className="result-card" style={paletteStyle(palettes[index])}>
              <ResultShape cut={cut} name={`Level ${index + 1}`} />
              <div className="result-details">
                <h2>Level {index + 1}</h2>
                <p className="result-percentages" aria-label={`${pieces[0].percentage.toFixed(1)} percent and ${pieces[1].percentage.toFixed(1)} percent`}>
                  <span>{pieces[0].percentage.toFixed(1)}<small>%</small></span>
                  <span className="result-divider" aria-hidden="true">/</span>
                  <span>{pieces[1].percentage.toFixed(1)}<small>%</small></span>
                </p>
                <p className="result-score">
                  <span role="img" aria-label={scores[index].name}>{scores[index].emoji}</span>
                  <strong>{scores[index].points.toLocaleString('en-US')}</strong>
                  <span> / 1,000</span>
                </p>
              </div>
            </li>
          )
        })}
      </ol>
      <details className="scoring-rules">
        <summary>How scoring works</summary>
        <p>Each cut earns up to 1,000 points. All five levels count equally.
          Points = 1,000 × (smaller percentage ÷ 50)<sup>{SCORE_EXPONENT}</sup>, rounded to a whole number.</p>
        <p>A 50/50 cut earns 1,000 points; 49/51 earns 817; 45/55 earns 349; 40/60 earns 107.</p>
        <ul>
          {CUT_RATINGS.map((rating, index) => (
            <li key={rating.name}>{rating.emoji} {rating.name}: {index === 0 ? 'a 50.0/50.0 split.' :
              `${index === CUT_RATINGS.length - 1 ? `more than ${CUT_RATINGS[index - 1].maximumError}` :
                `within ${rating.maximumError}`} percentage points from 50/50.`}</li>
          ))}
        </ul>
      </details>
    </>
  )
}
