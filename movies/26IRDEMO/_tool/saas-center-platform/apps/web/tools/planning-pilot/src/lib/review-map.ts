import type { ReviewItem, ReviewKind } from './content-review'
export const reviewColumns: ReviewKind[] = [
  'requirement',
  'feature',
  'scenario',
  'case'
]
export function reviewMap(items: ReviewItem[]) {
  const width = 1024,
    nodeWidth = 208,
    rowHeight = 116
  const columns = reviewColumns.map((kind) =>
    items.filter((item) => item.kind === kind)
  )
  const height = Math.max(
    360,
    ...columns.map((column) => column.length * rowHeight + 32)
  )
  const nodes = columns.flatMap((column, col) =>
    column.map((item, row) => ({
      item,
      x: col * 256 + 12,
      y: row * rowHeight + 16,
      width: nodeWidth,
      height: 96
    }))
  )
  const edges = nodes.flatMap((from) =>
    from.item.links.flatMap((key) => {
      const to = nodes.find((node) => node.item.key === key)
      if (!to) return []
      const x = from.x + nodeWidth,
        y = from.y + 48,
        tx = to.x,
        ty = to.y + 48
      return [
        {
          from: from.item.key,
          to: key,
          path: `M ${x} ${y} C ${x + 28} ${y}, ${tx - 28} ${ty}, ${tx} ${ty}`
        }
      ]
    })
  )
  return { width, height, nodes, edges }
}
