import { getPuzzleId } from './daily'
import { DAILY_LEVELS, generateDailyShape } from './dailyShapes'
import { measureCut } from './cut'
import type { SubmittedCut } from './cut'
import type { Point } from './polygon'

export type DailyProgress = {
  schema: 1
  date: string
  id: string
  level: number
  shapes: Point[][]
  cuts: (SubmittedCut | null)[]
}

const ACTIVE_KEY = 'fiddyfiddy:active-date'
const dayKey = (date: string) => `fiddyfiddy:day:${date}`
const validDate = (date: unknown): date is string => typeof date === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T00:00:00Z`))

function isPoint(value: unknown): value is Point {
  if (!value || typeof value !== 'object') return false
  const point = value as Point
  return Number.isFinite(point.x) && Number.isFinite(point.y) && Math.abs(point.x) <= 2 && Math.abs(point.y) <= 2
}

function validCut(value: unknown): value is SubmittedCut {
  if (!value || typeof value !== 'object') return false
  const cut = value as SubmittedCut
  if (!isPoint(cut.start) || !isPoint(cut.end) || !Array.isArray(cut.outline) ||
    cut.outline.length < 3 || cut.outline.length > 4096 || !cut.outline.every(isPoint) ||
    !Number.isFinite(cut.aspect) || cut.aspect < 0.1 || cut.aspect > 10) return false
  try {
    return measureCut(cut).every(({ area }) => Number.isFinite(area) && area > 0)
  } catch {
    return false
  }
}

export const isDayComplete = (progress: DailyProgress) => progress.cuts.every((cut) => cut !== null)

export function loadProgress(date: string): DailyProgress | null {
  try {
    const value = JSON.parse(localStorage.getItem(dayKey(date)) ?? 'null') as DailyProgress | null
    if (!value || value.schema !== 1 || value.date !== date || !validDate(value.date) ||
      typeof value.id !== 'string' || !new RegExp(`^fiddyfiddy:v\\d+:${date}$`).test(value.id) ||
      !Number.isInteger(value.level) || value.level < 0 || value.level >= DAILY_LEVELS.length ||
      !Array.isArray(value.shapes) || value.shapes.length !== DAILY_LEVELS.length ||
      !value.shapes.every((shape) => Array.isArray(shape) && shape.length >= 3 && shape.length <= 100 && shape.every(isPoint)) ||
      !Array.isArray(value.cuts) || value.cuts.length !== DAILY_LEVELS.length) return null
    let empty = false
    for (const cut of value.cuts) {
      if (cut === null) empty = true
      else if (empty || !validCut(cut)) return null
    }
    if (value.cuts.slice(0, value.level).some((cut) => cut === null)) return null
    return value
  } catch {
    return null
  }
}

export function createProgress(date: string): DailyProgress {
  const id = getPuzzleId(date)
  return {
    schema: 1, date, id, level: 0,
    // Store the generated controls so an update cannot change an ongoing set.
    shapes: DAILY_LEVELS.map((_, level) => generateDailyShape(id, level)),
    cuts: DAILY_LEVELS.map(() => null),
  }
}

export function resolveActiveDate(today: string): string {
  try {
    const date = localStorage.getItem(ACTIVE_KEY)
    if (validDate(date) && date <= today) {
      const progress = loadProgress(date)
      if (progress && !isDayComplete(progress) && progress.cuts.some(Boolean)) return date
    }
  } catch { /* Storage may be unavailable; the game still works in memory. */ }
  return today
}

export function saveProgress(next: DailyProgress): { progress: DailyProgress; saved: boolean } {
  // First submitted cut wins, including when another tab has already saved it.
  const existing = loadProgress(next.date)
  const progress = existing ? {
    ...next,
    id: existing.id,
    shapes: existing.id === next.id ? next.shapes : existing.shapes,
    level: Math.max(existing.level, next.level),
    cuts: existing.cuts.map((cut, level) => cut ?? next.cuts[level]),
  } : next
  try {
    localStorage.setItem(dayKey(progress.date), JSON.stringify(progress))
    if (!isDayComplete(progress)) localStorage.setItem(ACTIVE_KEY, progress.date)
    else if (localStorage.getItem(ACTIVE_KEY) === progress.date) localStorage.removeItem(ACTIVE_KEY)
    return { progress, saved: true }
  } catch {
    return { progress, saved: false }
  }
}

export function watchProgress(date: string, onChange: (progress: DailyProgress) => void) {
  const refresh = (event: StorageEvent) => {
    if (event.key !== dayKey(date)) return
    const progress = loadProgress(date)
    if (progress) onChange(progress)
  }
  window.addEventListener('storage', refresh)
  return () => window.removeEventListener('storage', refresh)
}
