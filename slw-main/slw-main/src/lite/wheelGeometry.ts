export const WHEEL_CENTER = 320
export const WHEEL_RADIUS = 222
export function scoreValue(value: number): number {
  return Number.isNaN(value) ? 0 : Math.max(0, Math.min(10, value))
}
export function wheelPoint(index: number, value: number) {
  const angle = -Math.PI / 2 + index * Math.PI / 4
  const radius = WHEEL_RADIUS * scoreValue(value) / 10
  return { x: WHEEL_CENTER + Math.cos(angle) * radius, y: WHEEL_CENTER + Math.sin(angle) * radius }
}
// Each cubic stays in its 45-degree sector with ordered control-point angles.
// Tangents use the circular-arc factor; shared tangents are continuous.
// Zero scores necessarily meet at the origin, with zero tangent there.
export function membranePath(values: readonly number[], scale = 1): string {
  const radii = values.map(value => WHEEL_RADIUS * scoreValue(value) / 10 * scale)
  const points = radii.map((r, i) => {
    const a = -Math.PI / 2 + i * Math.PI / 4
    return { x: 320 + r * Math.cos(a), y: 320 + r * Math.sin(a) }
  })
  const tangents = radii.map((r, i) => {
    const length = 4 / 3 * Math.tan(Math.PI / 16) * r
    const a = -Math.PI / 2 + i * Math.PI / 4
    return { x: -Math.sin(a) * length, y: Math.cos(a) * length }
  })
  let path = `M ${points[0].x} ${points[0].y}`
  for (let i = 0; i < 8; i++) {
    const j = (i + 1) % 8, p = points[i], q = points[j], t = tangents[i], u = tangents[j]
    path += ` C ${p.x + t.x} ${p.y + t.y} ${q.x - u.x} ${q.y - u.y} ${q.x} ${q.y}`
  }
  return path + ' Z'
}
export function interpolateScores(from: readonly number[], to: readonly number[], progress: number): number[] {
  const t = Math.max(0, Math.min(1, progress))
  const eased = t * t * (3 - 2 * t)
  return to.map((value, i) => from[i] + (value - from[i]) * eased)
}


// Decorative ribbons share the eight semantic anchors. Only their inner control
// points bow toward the centre, so material detail never moves score positions.
export function membraneWeave(values: readonly number[], thread: number, ribbon = false): string {
  const factor = 4 / 3 * Math.tan(Math.PI / 16)
  const point = (i: number) => wheelPoint(i % 8, values[i % 8])
  const controls = (i: number, depth: number) => {
    const a = -Math.PI / 2 + i * Math.PI / 4
    const p = point(i), r = WHEEL_RADIUS * scoreValue(values[i % 8]) / 10
    return { x: p.x - Math.cos(a) * r * depth, y: p.y - Math.sin(a) * r * depth, tx: -Math.sin(a) * r * factor, ty: Math.cos(a) * r * factor }
  }
  let path = ''
  for (let i = 0; i < 8; i++) {
    const p = point(i), q = point(i + 1)
    const depthA = .025 + thread * .014 + .095 * (.5 + .5 * Math.sin(i * 2.7 + thread * 1.8))
    const depthB = .018 + thread * .012 + .11 * (.5 + .5 * Math.cos(i * 2.1 - thread * 1.2))
    const a = controls(i, depthA), b = controls(i + 1, depthB)
    path += ` M ${p.x} ${p.y} C ${a.x + a.tx} ${a.y + a.ty} ${b.x - b.tx} ${b.y - b.ty} ${q.x} ${q.y}`
    if (ribbon) {
      const c = controls(i + 1, depthB + .04 + thread * .008), d = controls(i, depthA + .055 + thread * .008)
      path += ` C ${c.x - c.tx} ${c.y - c.ty} ${d.x + d.tx} ${d.y + d.ty} ${p.x} ${p.y} Z`
    }
  }
  return path
}

