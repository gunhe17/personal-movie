import { describe, expect, it } from 'vitest'
import seed from '../../plans/plan-42a3a371.json'
import { parsePlan } from './schema'
import { flowMap } from './flow-map'

const scenarios = parsePlan(seed).scenarios!
const normal = scenarios.find((scenario) => scenario.kind === 'normal')!

describe.each([false, true])('flow map, vertical=%s', (vertical) => {
  it('connects every exception to its fork and keeps it out of the normal success path', () => {
    const layout = flowMap(normal, scenarios, vertical)
    const exceptions = scenarios.filter(
      (scenario) => scenario.branch?.scenarioId === normal.id
    )
    expect(layout.nodes).toHaveLength(normal.steps.length + exceptions.length)
    const mainEdges = layout.edges.filter((edge) => edge.kind === 'normal')
    expect(mainEdges.map((edge) => [edge.from, edge.to])).toEqual(
      normal.steps
        .slice(1)
        .map((step, index) => [
          'step-' + normal.steps[index].id,
          'step-' + step.id
        ])
    )
    for (const exception of exceptions) {
      expect(
        layout.edges.filter((edge) => edge.to === 'exception-' + exception.id)
      ).toEqual([
        expect.objectContaining({
          from: 'step-' + exception.branch!.stepId,
          kind: 'exception'
        })
      ])
      expect(
        layout.edges.some((edge) => edge.from === 'exception-' + exception.id)
      ).toBe(false)
    }
  })

  it('keeps crowded branches inside the canvas without overlapping any node', () => {
    const crowded = Array.from({ length: 15 }, (_, index) => ({
      ...scenarios.find((scenario) => scenario.branch)!,
      id: 'crowded-' + index,
      branch: { scenarioId: normal.id, stepId: normal.steps[0].id }
    }))
    const layout = flowMap(normal, [normal, ...crowded], vertical)
    expect(layout.nodes).toHaveLength(normal.steps.length + 15)
    for (const [index, node] of layout.nodes.entries()) {
      expect(node.x).toBeGreaterThanOrEqual(0)
      expect(node.y).toBeGreaterThanOrEqual(0)
      expect(node.x + node.width).toBeLessThan(layout.width)
      expect(node.y + node.height).toBeLessThan(layout.height)
      for (const other of layout.nodes.slice(index + 1)) {
        const overlaps =
          node.x < other.x + other.width &&
          node.x + node.width > other.x &&
          node.y < other.y + other.height &&
          node.y + node.height > other.y
        expect(overlaps).toBe(false)
      }
    }
  })

  it('does not attach standalone exceptions or branches from another normal path', () => {
    const exception = scenarios.find((scenario) => scenario.branch)!
    const layout = flowMap(
      normal,
      [
        normal,
        { ...exception, id: 'standalone', branch: undefined },
        {
          ...exception,
          id: 'another-path',
          branch: { scenarioId: 'another-normal', stepId: normal.steps[0].id }
        }
      ],
      vertical
    )
    expect(layout.nodes.every((node) => node.kind === 'step')).toBe(true)
    expect(layout.edges.every((edge) => edge.kind === 'normal')).toBe(true)
  })
})
