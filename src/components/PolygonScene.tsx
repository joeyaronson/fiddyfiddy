import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import * as THREE from 'three'
import type { Point } from '../lib/polygon'
import { roundOutline } from '../lib/outline'
import type { SubmittedCut } from '../lib/cut'
import { CutResults } from './CutResults'
import { layoutCut } from '../lib/cutLayout'
import { createSplitAnimation } from '../lib/splitAnimation'
import { fitSubmittedCut } from '../lib/cut'

export function PolygonScene({ points, onBoundaryChange, submittedCut, onResultsComplete, onReady, ready, skipAnimations }: {
  points: Point[]
  onBoundaryChange: (boundary: Point[]) => void
  submittedCut: SubmittedCut | null
  onResultsComplete: () => void
  onReady: () => void
  ready: boolean
  skipAnimations: boolean
}) {
  const stage = useRef<HTMLDivElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [perfect, setPerfect] = useState(false)
  const onPerfect = useCallback(() => setPerfect(true), [])
  const [activeSplit, setActiveSplit] = useState<{ source: SubmittedCut; cut: SubmittedCut } | null>(null)
  const [size, setSize] = useState({ width: 1, height: 1 })
  const startSplit = useRef<((cut: SubmittedCut) => void) | null>(null)
  const hasEntered = useRef(skipAnimations)
  const outline = useMemo(() => roundOutline(points), [points])
  const fallbackPath = outline.map(({ start, control, end }, index) =>
    `${index === 0 ? 'M' : 'L'} ${start.x} ${-start.y} Q ${control.x} ${-control.y} ${end.x} ${-end.y}`,
  ).join(' ') + ' Z'
  const shape = useMemo(() => {
    const result = new THREE.Shape()
    outline.forEach(({ start, control, end }, index) => {
      if (index === 0) result.moveTo(start.x, start.y)
      else result.lineTo(start.x, start.y)
      result.quadraticCurveTo(control.x, control.y, end.x, end.y)
    })
    result.closePath()
    return result
  }, [outline])

  useEffect(() => {
    const host = stage.current
    if (!host) return
    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      if (width && height) setSize({ width, height })
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!unavailable || !stage.current) return
    const host = stage.current
    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      if (!width || !height) return
      const scale = Math.min(width, height) / 2.6
      onBoundaryChange(shape.getPoints(16).map(({ x, y }) => ({
        x: 0.5 + x * scale / width, y: 0.5 - y * scale / height,
      })))
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    resize()
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const finishIfReduced = () => {
      if (hasEntered.current || motion.matches) {
        hasEntered.current = true
        onReady()
      }
    }
    motion.addEventListener('change', finishIfReduced)
    finishIfReduced()
    return () => {
      observer.disconnect()
      motion.removeEventListener('change', finishIfReduced)
    }
  }, [unavailable, shape, onBoundaryChange, onReady])

  useEffect(() => {
    const host = container.current
    if (!host) return

    let renderer: THREE.WebGLRenderer
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    } catch {
      setUnavailable(true)
      return
    }
    setUnavailable(false)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setClearColor(0x000000, 0)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1.4, 1.4, 1.4, -1.4, 0.1, 20)
    camera.position.set(0, 0, 5)

    const geometry = new THREE.ExtrudeGeometry(shape, {
      depth: 0.15,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 16,
    })
    geometry.translate(0, 0, -0.075)
    const material = new THREE.MeshBasicMaterial({
      color: getComputedStyle(host).getPropertyValue('--shape-fill').trim(),
    })
    const sideMaterial = new THREE.MeshBasicMaterial({ color: 0x191919 })
    const edgeGeometry = new THREE.EdgesGeometry(geometry)
    const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x191919 })
    const group = new THREE.Group()
    group.add(new THREE.Mesh(geometry, [material, sideMaterial]))
    group.add(new THREE.LineSegments(edgeGeometry, edgeMaterial))
    // Trace both rims explicitly; EdgesGeometry omits shallow curve segments.
    const rimPoints = shape.getPoints(16)
    const rimGeometry = new THREE.BufferGeometry().setFromPoints(
      rimPoints.map(({ x, y }) => new THREE.Vector3(x, y, 0)),
    )
    for (const z of [-0.075, 0.075]) {
      const rim = new THREE.LineLoop(rimGeometry, edgeMaterial)
      rim.position.z = z
      group.add(rim)
    }
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let entranceComplete = motion.matches || hasEntered.current
    const setPose = (progress: number) => {
      const ease = 1 - (1 - progress) ** 3
      const back = 1 + 2.70158 * (progress - 1) ** 3 + 1.70158 * (progress - 1) ** 2
      group.scale.setScalar(Math.max(0.001, back))
      group.rotation.set(-0.18 + 0.9 * (1 - ease), 0.12 - Math.PI * 2 * (1 - ease), -0.5 * (1 - ease))
    }
    setPose(entranceComplete ? 1 : 0)
    scene.add(group)

    let contextLost = false
    let entranceFrame = 0
    let split: ReturnType<typeof createSplitAnimation> | null = null
    startSplit.current = (cut) => {
      if (contextLost || split) return
      split = createSplitAnimation({ cut, source: group, camera, scene, renderer, motion, immediate: skipAnimations,
        materials: { face: material, side: sideMaterial, edge: edgeMaterial } })
    }
    const resize = () => {
      if (contextLost) return
      const { width, height } = host.getBoundingClientRect()
      if (!width || !height) return
      const aspect = width / height
      const halfHeight = 1.3 / Math.min(aspect, 1)
      camera.left = -halfHeight * aspect
      camera.right = halfHeight * aspect
      camera.top = halfHeight
      camera.bottom = -halfHeight
      camera.updateProjectionMatrix()
      renderer.setSize(width, height)
      split?.resize()
      renderer.render(scene, camera)
      if (!entranceComplete) return
      onBoundaryChange(rimPoints.map(({ x, y }) => {
        const point = new THREE.Vector3(x, y, 0.075).applyMatrix4(group.matrixWorld).project(camera)
        return { x: (point.x + 1) / 2, y: (1 - point.y) / 2 }
      }))
    }
    const observer = new ResizeObserver(resize)
    observer.observe(host)
    const lost = (event: Event) => {
      event.preventDefault()
      contextLost = true
      cancelAnimationFrame(entranceFrame)
      split?.dispose()
      split = null
      setUnavailable(true)
    }
    renderer.domElement.addEventListener('webglcontextlost', lost)
    resize()

    let started: number | null = null
    const finishEntrance = () => {
      entranceComplete = true
      hasEntered.current = true
      setPose(1)
      resize()
      onReady()
    }
    const animateEntrance = (time: number) => {
      if (contextLost) return
      started ??= time
      const progress = Math.min(1, (time - started) / 1200)
      setPose(progress)
      renderer.render(scene, camera)
      if (progress < 1) entranceFrame = requestAnimationFrame(animateEntrance)
      else finishEntrance()
    }
    const reduceMotion = () => {
      if (motion.matches && !entranceComplete && !contextLost) {
        cancelAnimationFrame(entranceFrame)
        finishEntrance()
      }
    }
    motion.addEventListener('change', reduceMotion)
    if (entranceComplete) finishEntrance()
    else entranceFrame = requestAnimationFrame(animateEntrance)

    return () => {
      cancelAnimationFrame(entranceFrame)
      motion.removeEventListener('change', reduceMotion)
      startSplit.current = null
      split?.dispose()
      observer.disconnect()
      renderer.domElement.removeEventListener('webglcontextlost', lost)
      geometry.dispose()
      material.dispose()
      sideMaterial.dispose()
      edgeGeometry.dispose()
      rimGeometry.dispose()
      edgeMaterial.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [shape, onBoundaryChange, onReady, skipAnimations])

  useEffect(() => {
    if (!submittedCut) return
    const frame = requestAnimationFrame(() => {
      const bounds = stage.current?.getBoundingClientRect()
      if (!bounds?.width || !bounds.height) return
      const cut = fitSubmittedCut(submittedCut, bounds.width / bounds.height)
      if (unavailable || startSplit.current) {
        if (!unavailable) startSplit.current?.(cut)
        setActiveSplit({ source: submittedCut, cut })
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [submittedCut, unavailable])

  const displayCut = activeSplit?.source === submittedCut ? activeSplit?.cut ?? null : null
  const chopping = displayCut !== null
  const layout = useMemo(() => displayCut ? layoutCut(displayCut) : [], [displayCut])
  const pieces = chopping && unavailable ? layout.map((piece) => {
    const { side } = piece
    const dx = (displayCut.end.x - displayCut.start.x) * size.width
    const dy = (displayCut.end.y - displayCut.start.y) * size.height
    const length = Math.hypot(dx, dy) || 1
    const gap = Math.min(size.width, size.height) * 0.065
    return {
      side,
      style: {
        clipPath: `polygon(${piece.outline.map(({ x, y }) => `${x * 100}% ${y * 100}%`).join(', ')})`,
        transformOrigin: `${piece.centerX * 100}% ${piece.centerY * 100}%`,
        '--chop-x': `${-dy / length * gap * side / size.width * 100}%`,
        '--chop-y': `${dx / length * gap * side / size.height * 100}%`,
        '--chop-turn': `${side * 26}deg`,
        '--chop-flip': `${side * 360}deg`,
        '--chop-tilt': `${side * 24}deg`,
        '--settle-x': `${(piece.targetX - piece.centerX) * 100}%`,
        '--settle-y': `${(piece.targetY - piece.centerY) * 100}%`,
        '--settle-scale': piece.scale,
      } as CSSProperties,
    }
  }) : []

  return (
    <div ref={stage} className={`polygon-stage${perfect ? ' is-perfect' : ''}${skipAnimations ? ' skip-animations' : ''}`} role="group" aria-label="Daily shape to split into equal areas">
      <div ref={container} className="polygon-canvas" hidden={unavailable} />
      {unavailable && !chopping && (
        <svg viewBox="-1.3 -1.3 2.6 2.6" aria-hidden="true">
          <g className={ready ? undefined : 'shape-entrance'} onAnimationEnd={() => {
            hasEntered.current = true
            onReady()
          }}>
          <path
            d={fallbackPath}
            fill="var(--shape-fill)" stroke="var(--shape-edge)" strokeWidth="0.02"
          />
          </g>
        </svg>
      )}
      {pieces.map(({ side, style }) => (
        <div key={side} className="chop-piece" style={style} aria-hidden="true">
          <svg viewBox="-1.3 -1.3 2.6 2.6">
            <path d={fallbackPath} fill="var(--shape-fill)" stroke="var(--shape-edge)" strokeWidth="0.02" />
          </svg>
        </div>
      ))}
      {chopping && <CutResults cut={displayCut} onComplete={onResultsComplete} onPerfect={onPerfect} instant={skipAnimations} />}

    </div>
  )
}
