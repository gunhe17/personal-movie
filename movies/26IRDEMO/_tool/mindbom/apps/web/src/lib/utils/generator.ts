export const generateId = (): string => {
  return `modal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}
