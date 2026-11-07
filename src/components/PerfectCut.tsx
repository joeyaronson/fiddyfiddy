const colors = ['var(--piece-a)', 'var(--piece-b)', 'var(--shape-fill)', '#8ed9ff', '#ff80af']
const particles = Array.from({ length: 64 }, (_, index) => {
  const angle = index * 2.399963
  const radius = 250 + (index * 37) % 260
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius - 140,
    rotation: (index % 2 ? 1 : -1) * (180 + index * 23),
    delay: (index % 8) * 18,
  }
})

export function PerfectCut() {
  return (
    <div className="perfect-celebration" aria-hidden="true">
      <svg className="perfect-confetti" viewBox="0 0 1000 1000" preserveAspectRatio="none">
        {particles.map((particle, index) => (
          <g key={index} transform="translate(500 400)">
            <rect className="perfect-confetti-piece" width={index % 3 ? 12 : 20} height={index % 3 ? 26 : 20}
              fill={colors[index % colors.length]} stroke="#191919" strokeWidth="2"
              style={{
                '--confetti-x': `${particle.x}px`,
                '--confetti-y': `${particle.y}px`,
                '--confetti-spin': `${particle.rotation}deg`,
                animationDelay: `${particle.delay}ms`,
              } as CSSProperties} />
          </g>
        ))}
      </svg>
      <div className="perfect-stamp"><span>Perfect cut</span><strong>50/50</strong></div>
    </div>
  )
}
import type { CSSProperties } from 'react'

