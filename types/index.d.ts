export type Limit = { kind: string; percentUsed: number; resetsAt?: string }
export type Context = { tokens?: number; window: number; percent?: number }
export type Agent = { id: string; label: string }

declare module 'claude-code' {
  interface PluginState {
    'usage-band': {
      limits: Limit[]
      now: number
      model: string
      effort: string
      context: Context | null
      agents: Agent[]
    }
  }
}
