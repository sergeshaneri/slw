import { useLayoutEffect, useRef, type RefObject } from 'react'
import { interpolateScores, membranePath, membraneWeave, wheelPoint } from './wheelGeometry'

const format = (value: number) => value.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export function useWheelMotion(root: RefObject<HTMLDivElement>, target: number[]) {
  const current = useRef(target)
  const trail = useRef(target)
  const energy = useRef(0)
  const targetKey = target.join(',')
  function paint() {
    const element = root.current
    if (!element) return
    const values = current.current
    element.querySelectorAll<SVGPathElement>('[data-membrane]').forEach(path => {
      const isTrail = path.dataset.membrane === 'trail'
      path.setAttribute('d', path.dataset.thread !== undefined ? membraneWeave(values, Number(path.dataset.thread), path.dataset.membrane === 'ribbon') : membranePath(isTrail ? trail.current : values, Number(path.dataset.scale ?? 1)))
      if (isTrail) path.style.opacity = String(energy.current * .45)
      if (path.dataset.membrane === 'strand') {
        path.style.strokeDashoffset = String(-energy.current * 18)
        path.style.opacity = String(.35 + energy.current * .45)
      }
    })
    element.querySelectorAll<SVGCircleElement>('[data-node]').forEach(node => {
      const point = wheelPoint(Number(node.dataset.node), values[Number(node.dataset.node)])
      node.setAttribute('cx', String(point.x + Number(node.dataset.dx ?? 0))); node.setAttribute('cy', String(point.y + Number(node.dataset.dy ?? 0)))
    })
    element.querySelectorAll<SVGSVGElement>('[data-orb]').forEach(node => {
      const point = wheelPoint(Number(node.dataset.orb), values[Number(node.dataset.orb)])
      node.setAttribute('x', String(point.x - 4.5)); node.setAttribute('y', String(point.y - 4.5))
    })
    element.querySelectorAll<HTMLElement>('[data-score]').forEach(label => {
      label.textContent = format(values[Number(label.dataset.score)]) + (label.dataset.suffix ?? '')
    })
    element.querySelectorAll<HTMLElement>('[data-average]').forEach(label => {
      label.textContent = format(values.reduce((sum, value) => sum + value, 0) / 8)
    })
    element.querySelectorAll<HTMLButtonElement>('[data-axis]').forEach(button => {
      button.setAttribute('aria-label', button.dataset.axis + ', ' + format(values[Number(button.dataset.index)]) + ' из 10')
    })
  }
  // Restore the current frame after React renders selection/focus during a transition.
  useLayoutEffect(() => { paint() })
  useLayoutEffect(() => {
    const from = [...current.current]
    const fromTrail = [...trail.current]
    const startEnergy = energy.current
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const start = performance.now()
    let frame = 0
    const finish = () => {
      cancelAnimationFrame(frame)
      current.current = [...target]; trail.current = [...target]; energy.current = 0
      paint()
    }
    const changed = from.some((value, i) => value !== target[i])
    const tick = (now: number) => {
      const elapsed = now - start
      current.current = interpolateScores(from, target, elapsed / 640)
      trail.current = interpolateScores(fromTrail, target, Math.max(0, elapsed - 65) / 640)
      const phase = Math.min(1, elapsed / 705)
      energy.current = startEnergy * (1 - phase) + (1 - startEnergy) * Math.sin(Math.PI * phase)
      paint()
      if (elapsed < 705) frame = requestAnimationFrame(tick)
      else finish()
    }
    const onPreference = () => { if (media.matches) finish() }
    media.addEventListener('change', onPreference)
    if (media.matches || !changed) finish()
    else frame = requestAnimationFrame(tick)
    return () => { cancelAnimationFrame(frame); media.removeEventListener('change', onPreference) }
    // targetKey represents every score; object identity does not restart motion.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetKey])
}
