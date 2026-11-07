// Change the version when the generator or its input data changes.
export const GENERATOR_VERSION = 'v1'

export function getPuzzleDate(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10)
}

export function getPuzzleId(date: string): string {
  return `fiddyfiddy:${GENERATOR_VERSION}:${date}`
}

// FNV-1a hash followed by Mulberry32. Keep stable within a version.
export function createSeededRandom(seed: string): () => number {
  let state = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    state = Math.imul(state ^ seed.charCodeAt(i), 0x01000193) >>> 0
  }
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = Math.imul(state ^ (state >>> 15), state | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}
