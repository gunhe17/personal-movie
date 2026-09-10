import type { Scenario, ScenarioStep } from './types'

export interface FlowNode {
  id: string
  kind: 'step' | 'exception'
  x: number
  y: number
  width: number
  height: number
  step?: ScenarioStep
  scenario?: Scenario
  column: number
}
export interface FlowEdge {
  from: string
  to: string
  kind: 'normal' | 'exception'
  path: string
}
export function flowMap(
  normal: Scenario,
  scenarios: Scenario[],
  vertical = false
) {
  const nodes: FlowNode[] = []
  const edges: FlowEdge[] = []
  const width = 176
  let rowY = 30
  normal.steps.forEach((step, column) => {
    const branches = scenarios.filter(
      (scenario) =>
        scenario.branch?.scenarioId === normal.id &&
        scenario.branch.stepId === step.id
    )
    const parent: FlowNode = {
      id: 'step-' + step.id,
      kind: 'step',
      x: vertical ? 26 : 30 + column * 212,
      y: vertical ? rowY : 36,
      width,
      height: 86,
      step,
      column
    }
    nodes.push(parent)
    branches.forEach((scenario, index) => {
      const branch: FlowNode = {
        id: 'exception-' + scenario.id,
        kind: 'exception',
        x: vertical ? 252 : parent.x,
        y: vertical ? rowY + index * 88 : 188 + index * 88,
        width,
        height: 72,
        scenario,
        column
      }
      nodes.push(branch)
      const path = vertical
        ? `M ${parent.x + width} ${parent.y + 43} H ${parent.x + width + 24} V ${branch.y + 36} H ${branch.x}`
        : `M ${parent.x + width / 2} ${parent.y + 86} V ${parent.y + 106} H ${parent.x - 14} V ${branch.y + 36} H ${branch.x}`
      edges.push({ from: parent.id, to: branch.id, kind: 'exception', path })
    })
    if (vertical) rowY += Math.max(140, branches.length * 88 + 40)
  })
  const main = nodes.filter((node) => node.kind === 'step')
  main.slice(1).forEach((node, index) => {
    const previous = main[index]
    edges.push({
      from: previous.id,
      to: node.id,
      kind: 'normal',
      path: vertical
        ? `M ${previous.x + width / 2} ${previous.y + 86} V ${node.y}`
        : `M ${previous.x + width} ${previous.y + 43} H ${node.x}`
    })
  })
  return {
    nodes,
    edges,
    width: Math.max(300, ...nodes.map((node) => node.x + node.width + 30)),
    height: Math.max(250, ...nodes.map((node) => node.y + node.height + 38))
  }
}
