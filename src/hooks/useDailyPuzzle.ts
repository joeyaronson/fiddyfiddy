import { useEffect, useState } from 'react'
import { getPuzzleDate, getPuzzleId } from '../lib/daily'

// Capture this identity at the start of an attempt to preserve active play.
export function useDailyPuzzle() {
  const [date, setDate] = useState(getPuzzleDate)
  useEffect(() => {
    const refresh = () => setDate(getPuzzleDate())
    const interval = window.setInterval(refresh, 1000)
    window.addEventListener('focus', refresh)
    document.addEventListener('visibilitychange', refresh)
    refresh()
    return () => {
      window.clearInterval(interval)
      window.removeEventListener('focus', refresh)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])
  return { date, id: getPuzzleId(date) }
}
