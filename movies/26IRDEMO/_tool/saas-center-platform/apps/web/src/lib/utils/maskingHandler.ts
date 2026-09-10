export const maskName = (name: string) => {
  if (!name) return ''
  if (name.length <= 1) return '*'
  if (name.length === 2) return `${name[0]}*`
  return `${name[0]}*${name[name.length - 1]}`
}

export const maskPhone = (phone: string) => {
  if (!phone) return ''
  // 010-1234-5678 → 010-****-****
  return phone.replace(/\d{4}-\d{4}$/, '****-****')
}

export const maskBirthDate = (date: Date) => {
  // YYYY. **. **
  return `${date.getFullYear()}. **. **`
}

export const maskAllText = (text: string) => {
  if (!text) return ''
  return '*'.repeat(text.length)
}
