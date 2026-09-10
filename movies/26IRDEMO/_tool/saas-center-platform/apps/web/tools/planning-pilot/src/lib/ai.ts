export interface AIConnection {
  provider: 'codex' | 'claude' | 'none'
  mode: 'thread' | 'cli' | 'off'
  available: boolean
  label: string
  model: string
}
