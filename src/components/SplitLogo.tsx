export function SplitLogo() {
  const left = '15,10 86,4 82,50 29,55 3,32'
  const right = '95,4 158,12 173,34 143,54 91,50'
  return (
    <svg className="split-logo" viewBox="0 0 180 60" aria-hidden="true" focusable="false">
      <g fill="currentColor" transform="translate(3 3)">
        <polygon points={left} />
        <polygon points={right} />
      </g>
      <g stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round">
        <polygon points={left} fill="#ffe35b" />
        <polygon points={right} fill="#ff92bb" />
      </g>
      <g className="split-logo-text" fill="currentColor" textAnchor="middle">
        <text x="45" y="35">fiddy</text>
        <text x="130" y="35">fiddy</text>
      </g>
    </svg>
  )
}
