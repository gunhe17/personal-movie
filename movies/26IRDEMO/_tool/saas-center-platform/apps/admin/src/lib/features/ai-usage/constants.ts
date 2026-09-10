export type AlertLevel = 'normal' | 'warning' | 'critical'

export const ALERT_CONFIG: Record<AlertLevel, {
  bg: string
  text: string
  border: string
  dot: string
  label: string
}> = {
  normal: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    dot: 'bg-green-500',
    label: '정상',
  },
  warning: {
    bg: 'bg-yellow-50',
    text: 'text-yellow-700',
    border: 'border-yellow-200',
    dot: 'bg-yellow-500',
    label: '주의',
  },
  critical: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    dot: 'bg-red-500',
    label: '경고',
  },
}

export const ALERT_THRESHOLDS = {
  warning: 50,
  critical: 100,
} as const
