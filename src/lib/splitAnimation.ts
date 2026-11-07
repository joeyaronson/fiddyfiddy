import * as THREE from 'three'
import type { SubmittedCut } from './cut'
import { CHOP_DURATION, layoutCut } from './cutLayout'

const keyframes = [
  { at: 0, away: 0, lift: 0, tilt: 0, flip: 0, turn: 0, scale: 1, settle: 0 },
  { at: 0.09, away: 0.35, lift: 0.05, tilt: -0.4, flip: -0.04, turn: -0.12, scale: 0.98, settle: 0 },
  { at: 0.27, away: 1.5, lift: 0.3, tilt: 1, flip: 0.45, turn: 1, scale: 1.025, settle: 0 },
  { at: 0.46, away: 1.15, lift: 0.13, tilt: -0.35, flip: 0.9, turn: -0.22, scale: 1, settle: 0 },
  { at: 0.6, away: 1, lift: 0, tilt: 0, flip: 1, turn: 0, scale: 1, settle: 0 },
  { at: 1, away: 0, lift: 0, tilt: 0, flip: 1, turn: 0, scale: 1, settle: 1 },
]

export function createSplitAnimation({ cut, source, camera, scene, renderer, materials, motion, immediate = false }: {
  cut: SubmittedCut
  source: THREE.Group
  camera: THREE.OrthographicCamera
  scene: THREE.Scene
  renderer: THREE.WebGLRenderer
  materials: { face: THREE.MeshBasicMaterial; side: THREE.MeshBasicMaterial; edge: THREE.LineBasicMaterial }
  motion: MediaQueryList
  immediate?: boolean
}) {
  const root = new THREE.Group()
  const geometries: THREE.BufferGeometry[] = []
  const width = camera.right - camera.left
  const height = camera.top - camera.bottom
  source.updateMatrixWorld(true)
  camera.updateMatrixWorld(true)
  const sourceMatrix = source.matrixWorld.clone()
  const inverse = sourceMatrix.clone().invert()
  const facePlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.075).applyMatrix4(sourceMatrix)
  const raycaster = new THREE.Raycaster()
  const direction = new THREE.Vector2(
    (cut.end.x - cut.start.x) * width,
    -(cut.end.y - cut.start.y) * height,
  ).normalize()
  const normal = new THREE.Vector2(direction.y, -direction.x)
  const gap = Math.min(width, height) * 0.065

  const pieces = layoutCut(cut).map((piece) => {
    // Intersect the screen contour with the original top face, then extrude in
    // its own plane. This gives the new seam genuine side walls and a back face.
    const points = piece.outline.map(({ x, y }) => {
      raycaster.setFromCamera(new THREE.Vector2(x * 2 - 1, 1 - y * 2), camera)
      const point = raycaster.ray.intersectPlane(facePlane, new THREE.Vector3())!
      point.applyMatrix4(inverse)
      return new THREE.Vector2(point.x, point.y)
    })
    const center = new THREE.Vector3((piece.centerX - 0.5) * width, (0.5 - piece.centerY) * height, 0)
    const target = new THREE.Vector3((piece.targetX - 0.5) * width, (0.5 - piece.targetY) * height, 0)
    const geometry = new THREE.ExtrudeGeometry(new THREE.Shape(points), {
      depth: 0.15, bevelEnabled: false, steps: 1, curveSegments: 1,
    })
    geometry.translate(0, 0, -0.075)
    // Bake the resting orientation into the geometry so the final projected
    // outline stays aligned with the existing measurement overlay.
    geometry.applyMatrix4(sourceMatrix)
    geometry.translate(-center.x, -center.y, 0)
    const edges = new THREE.EdgesGeometry(geometry)
    const group = new THREE.Group()
    group.add(new THREE.Mesh(geometry, [materials.face, materials.side]))
    group.add(new THREE.LineSegments(edges, materials.edge))
    geometries.push(geometry, edges)
    for (const z of [-0.075, 0.075]) {
      const rim = new THREE.BufferGeometry().setFromPoints(points.map(({ x, y }) =>
        new THREE.Vector3(x, y, z).applyMatrix4(sourceMatrix).sub(center),
      ))
      geometries.push(rim)
      group.add(new THREE.LineLoop(rim, materials.edge))
    }
    root.add(group)
    return { ...piece, group, center, target }
  })
  source.visible = false
  scene.add(root)

  const pose = (progress: number) => {
    const next = keyframes.findIndex((frame) => frame.at >= progress)
    const b = keyframes[Math.max(1, next)]
    const a = keyframes[Math.max(1, next) - 1]
    const t = THREE.MathUtils.clamp((progress - a.at) / (b.at - a.at), 0, 1)
    const ease = 1 - (1 - t) ** 3
    const value = (key: 'away' | 'lift' | 'tilt' | 'flip' | 'turn' | 'scale' | 'settle') =>
      THREE.MathUtils.lerp(a[key], b[key], ease)
    for (const piece of pieces) {
      const settle = value('settle')
      piece.group.position.copy(piece.center).lerp(piece.target, settle)
      piece.group.position.x += normal.x * gap * piece.side * value('away')
      piece.group.position.y += normal.y * gap * piece.side * value('away')
      piece.group.position.z = value('lift')
      piece.group.rotation.set(
        THREE.MathUtils.degToRad(24) * piece.side * value('tilt'),
        Math.PI * 2 * piece.side * value('flip'),
        THREE.MathUtils.degToRad(26) * piece.side * value('turn'),
      )
      piece.group.scale.setScalar(value('scale') * THREE.MathUtils.lerp(1, piece.scale, settle))
    }
  }
  let frame = 0
  let start: number | null = null
  let finished = immediate || motion.matches
  const render = () => renderer.render(scene, camera)
  const tick = (time: number) => {
    start ??= time
    const progress = motion.matches ? 1 : THREE.MathUtils.clamp((time - start - 120) / (CHOP_DURATION - 120), 0, 1)
    pose(progress)
    render()
    finished = progress === 1
    if (!finished) frame = requestAnimationFrame(tick)
  }
  const reduceMotion = () => {
    if (motion.matches && !finished) {
      cancelAnimationFrame(frame)
      finished = true
      pose(1)
      render()
    }
  }
  motion.addEventListener('change', reduceMotion)
  pose(immediate || motion.matches ? 1 : 0)
  render()
  if (!immediate && !motion.matches) frame = requestAnimationFrame(tick)

  return {
    resize() {
      root.scale.set((camera.right - camera.left) / width, (camera.top - camera.bottom) / height, 1)
    },
    dispose() {
      cancelAnimationFrame(frame)
      motion.removeEventListener('change', reduceMotion)
      geometries.forEach((geometry) => geometry.dispose())
      scene.remove(root)
      source.visible = true
    },
  }
}
