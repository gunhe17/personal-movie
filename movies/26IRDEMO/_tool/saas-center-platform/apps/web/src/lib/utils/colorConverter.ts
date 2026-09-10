const COLOR_PALETTE = [
  '#F47500',
  '#017750',
  '#0176D0',
  '#49AAEF',
  '#EF4967',
  '#A78BFA',
  '#1395A1',
  '#22C55E',
  '#0EA5E9',
  '#EAB308',
  '#F97316',
  '#EC4899',
  '#6366F1',
  '#14B8A6',
  '#84CC16'
]

export const getColorFromString = (input: string): string => {
  let hash = 0
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length
  return COLOR_PALETTE[index]
}

export const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
