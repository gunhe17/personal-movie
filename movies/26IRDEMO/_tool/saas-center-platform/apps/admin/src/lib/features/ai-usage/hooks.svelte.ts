export function createAiUsageState() {
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${now.getMonth() + 1}`

  let selectedPeriod = $state(currentMonth)

  const monthOptions = $derived.by(() => {
    const opts: { value: string; title: string }[] = []
    const d = new Date(now.getFullYear(), now.getMonth())
    for (let i = 0; i < 24; i++) {
      opts.push({
        value: `${d.getFullYear()}-${d.getMonth() + 1}`,
        title: `${d.getFullYear()}년 ${d.getMonth() + 1}월`,
      })
      d.setMonth(d.getMonth() - 1)
    }
    return opts
  })

  const selectedMonth = $derived.by(() => {
    const [y, m] = selectedPeriod.split('-').map(Number)
    return `${y}-${String(m).padStart(2, '0')}`
  })

  const selectedDateFrom = $derived(`${selectedMonth}-01`)

  const selectedDateTo = $derived.by(() => {
    const [y, m] = selectedMonth.split('-').map(Number)
    return m === 12
      ? `${y + 1}-01-01`
      : `${y}-${String(m + 1).padStart(2, '0')}-01`
  })

  return {
    get currentMonth() { return currentMonth },
    get selectedPeriod() { return selectedPeriod },
    set selectedPeriod(v: string) { selectedPeriod = v },
    get selectedMonth() { return selectedMonth },
    get selectedDateFrom() { return selectedDateFrom },
    get selectedDateTo() { return selectedDateTo },
    get monthOptions() { return monthOptions },
  }
}
