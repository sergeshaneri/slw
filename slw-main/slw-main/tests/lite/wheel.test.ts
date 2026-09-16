import { describe, expect, it } from 'vitest'
import { membranePath, wheelPoint, scoreValue, interpolateScores } from '../../src/lite/wheelGeometry'
const fixtures = {
  equal: Array(8).fill(6), high: [9, 3, 3, 3, 3, 3, 3, 3], low: [1, 8, 8, 8, 8, 8, 8, 8],
  alternating: [10, 1, 10, 1, 10, 1, 10, 1], random: [7.2, 3.1, 8.8, 4.3, 6.1, 2.4, 9.2, 5.7],
  zero: Array(8).fill(0), extremes: [10, 0, 10, 0, 10, 0, 10, 0],
}
function samples(values: number[]) {
  const numbers = membranePath(values).match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/gi)!.map(Number)
  let p = { x: numbers[0], y: numbers[1] }
  const points = []
  for (let i = 2; i < numbers.length; i += 6) {
    const [ax, ay, bx, by, x, y] = numbers.slice(i, i + 6)
    for (let step = 1; step <= 32; step++) {
      const t = step / 32, u = 1 - t
      points.push({ x: u ** 3 * p.x + 3 * u * u * t * ax + 3 * u * t * t * bx + t ** 3 * x,
        y: u ** 3 * p.y + 3 * u * u * t * ay + 3 * u * t * t * by + t ** 3 * y })
    }
    p = { x, y }
  }
  return points
}
describe('data anchored membrane', () => {
  for (const [name, values] of Object.entries(fixtures)) it(name + ': exact nodes and ordered sectors', () => {
    const points = samples(values)
    for (let i = 0; i < 8; i++) {
      const node = wheelPoint((i + 1) % 8, values[(i + 1) % 8])
      expect(points[i * 32 + 31].x).toBeCloseTo(node.x, 9)
      expect(points[i * 32 + 31].y).toBeCloseTo(node.y, 9)
      // Monotone angular traversal in disjoint sectors excludes self-intersections.
      let previous = 0
      for (const p of points.slice(i * 32, (i + 1) * 32)) {
        if (Math.hypot(p.x - 320, p.y - 320) < 1e-8) continue
        const angle = -Math.PI / 2 + i * Math.PI / 4
        const x = (p.x - 320) * Math.cos(angle) + (p.y - 320) * Math.sin(angle)
        const y = -(p.x - 320) * Math.sin(angle) + (p.y - 320) * Math.cos(angle)
        const theta = Math.atan2(y, x)
        expect(theta).toBeGreaterThanOrEqual(previous - 1e-9)
        expect(theta).toBeLessThanOrEqual(Math.PI / 4 + 1e-9)
        previous = theta
      }
    }
  })
  it('equal values approximate a circle within .01 percent', () => {
    for (const p of samples(fixtures.equal)) expect(Math.abs(Math.hypot(p.x - 320, p.y - 320) - 133.2)).toBeLessThan(.014)
  })
  it('clamps and interpolates locally without overshoot', () => {
    expect([-3, 12, NaN, Infinity].map(scoreValue)).toEqual([0, 10, 0, 10])
    const from = Array(8).fill(5), to = [9, 5, 5, 5, 5, 5, 5, 5]
    expect(interpolateScores(from, to, .5)).toEqual([7, 5, 5, 5, 5, 5, 5, 5])
    expect(interpolateScores(from, to, 1)).toEqual(to)
  })
})
