import type { CSSProperties } from 'react'
import { createSeededRandom } from './daily'

const families = [
  { hue: 48, saturation: 96, lightness: 67 },
  { hue: 90, saturation: 85, lightness: 70 },
  { hue: 337, saturation: 92, lightness: 77 },
  { hue: 197, saturation: 87, lightness: 76 },
  { hue: 267, saturation: 82, lightness: 79 },
]

function hexColor(hue: number, saturation: number, lightness: number): string {
  const light = lightness / 100
  const amplitude = saturation / 100 * Math.min(light, 1 - light)
  const channel = (offset: number) => {
    const k = (offset + hue / 30) % 12
    const value = light - amplitude * Math.max(-1, Math.min(k - 3, 9 - k, 1))
    return Math.round(255 * value).toString(16).padStart(2, '0')
  }
  return `#${channel(0)}${channel(8)}${channel(4)}`
}

export function getDailyPalettes(date: string) {
  // Keep color randomness separate from puzzle generation so styling changes
  // never change the shapes or consume their random sequence.
  const random = createSeededRandom(`${date}:colors-v1`)
  const colors = families.map(({ hue, saturation, lightness }) => hexColor(
    hue + (random() - 0.5) * 14,
    saturation + (random() - 0.5) * 6,
    lightness + (random() - 0.5) * 5,
  ))
  for (let i = colors.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[colors[i], colors[j]] = [colors[j], colors[i]]
  }
  return colors.map((shape, index) => ({
    shape,
    pieceA: colors[(index + 1) % colors.length],
    pieceB: colors[(index + 3) % colors.length],
    accent: colors[(index + 2) % colors.length],
  }))
}

export function paletteStyle(palette: ReturnType<typeof getDailyPalettes>[number]): CSSProperties {
  return {
    '--shape-fill': palette.shape,
    '--piece-a': palette.pieceA,
    '--piece-b': palette.pieceB,
    '--level-accent': palette.accent,
  } as CSSProperties
}
