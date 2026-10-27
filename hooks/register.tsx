import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Agent, Context, Limit } from '../types'

const PANE = 'usage-band'
const TITLE = 'Usage'
// Fits "Week ███░░░░░░░ 100%"; the dock takes no fewer than 24 columns.
const COLUMNS = 24
const OPEN = { id: PANE, title: TITLE, columns: COLUMNS, rows: 14 }

const limits = atom({ plugin: 'usage-band', key: 'limits' } as const, [] as Limit[])
const now = atom({ plugin: 'usage-band', key: 'now' } as const, 0)
const model = atom({ plugin: 'usage-band', key: 'model' } as const, '')
const effort = atom({ plugin: 'usage-band', key: 'effort' } as const, '')
const context = atom({ plugin: 'usage-band', key: 'context' } as const, null as Context | null)
const agents = atom({ plugin: 'usage-band', key: 'agents' } as const, [] as Agent[])

const LABELS: Record<string, string> = { five_hour: '5h', seven_day: 'Week' }
const WIDTH = 10
const ACTIVE = new Set(['pending', 'running', 'waiting'])

// 84321 -> 84k, 1000000 -> 1M.
function tokens(n: number): string {
  return n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(1)}M` : `${Math.round(n / 1000)}k`
}

function clip(text: string, width: number): string {
  return text.length <= width ? text : `${text.slice(0, width - 1)}…`
}

// Light green while there is room, yellow as the window runs low, red near its end.
function colorFor(percent: number): string {
  return percent >= 90 ? 'red' : percent >= 70 ? 'yellow' : 'greenBright'
}

function bar(percent: number): string {
  const filled = Math.max(0, Math.min(WIDTH, Math.round((percent / 100) * WIDTH)))
  return '█'.repeat(filled) + '░'.repeat(WIDTH - filled)
}

function until(resetsAt: string | undefined, at: number): string {
  if (!resetsAt) return ''
  const minutes = Math.max(0, Math.round((Date.parse(resetsAt) - at) / 60000))
  const days = Math.floor(minutes / 1440)
  const hours = Math.floor((minutes % 1440) / 60)
  const mins = minutes % 60
  const left = days > 0 ? `${days}d ${hours}h` : hours > 0 ? `${hours}h ${mins}m` : `${mins}m`
  return `resets in ${left}`
}

// claude-opus-5-5[1m] -> Opus 5.5 (1M); a name that is already readable is kept.
function modelName(id: string): string {
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?:-\d{8})?(\[1m\])?$/i.exec(id)
  if (!match) return id
  const [, family = '', major, minor, isLong] = match
  const name = `${family.charAt(0).toUpperCase()}${family.slice(1)} ${major}${minor ? `.${minor}` : ''}`
  return isLong ? `${name} (1M)` : name
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'usage-band',
      description: 'Show the model, effort and usage limits in a side pane',
    })

    const refreshAgents = async () => {
      const list = await $.agent.list()
      const running = list
        .filter(a => ACTIVE.has(a.status))
        .map(a => ({ id: a.id, label: a.description || a.name || a.type }))
      await update($, agents, () => running)
    }

    const refresh = async () => {
      const usage = await $.session.usage()
      await update($, limits, () => usage.rateLimits)
      await update($, context, () => usage.context)
      const current = await $.session.model()
      await update($, model, () => current)
      const t = await $.clock.now()
      await update($, now, () => t)
    }
    await refresh()
    await refreshAgents()
    $.clock.every(60_000, refresh)
    // Agents start and finish between turns too; a list read is cheap.
    $.clock.every(5_000, refreshAgents)
    void $.ui.open(OPEN)

    return next(e)
  })

  on('command.run', { command: 'usage-band' }, async $ => {
    await $.ui.open(OPEN)

    return { text: 'Usage pane opened.' }
  })

  // A /model switch shows by the next prompt at the latest, else on the minute.
  on('prompt.submit', async ($, e, next) => {
    // Never hold up the prompt over the pane.
    await $.session
      .model()
      .then(current => update($, model, () => current))
      .catch(() => undefined)

    return next(e)
  })

  // Effort is known only once the main loop sends a request; subagents keep their own.
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId) {
      await update($, effort, () => (e.effort === undefined ? '' : String(e.effort))).catch(
        () => undefined,
      )
    }

    return yield* next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, limits, () => e.rateLimits)
    await update($, context, () => e.context)
    const t = await $.clock.now()
    await update($, now, () => t)

    return next(e)
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const shown = (await read($, limits)).filter(l => l.kind in LABELS)
    const current = await read($, model)
    const level = await read($, effort)
    const at = await read($, now)
    const ctx = await read($, context)
    const running = await read($, agents)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column" gap={1}>
        <Box flexDirection="column">
          <Text bold>{current ? modelName(current) : 'Model unknown'}</Text>
          <Text dimColor>effort {level || '—'}</Text>
        </Box>
        {ctx && ctx.percent !== undefined ? (
          <Box flexDirection="column">
            <Text color={colorFor(ctx.percent)}>
              Ctx {bar(ctx.percent)} {Math.round(ctx.percent)}%
            </Text>
            <Text dimColor>
              {tokens(ctx.tokens ?? 0)} / {tokens(ctx.window)}
            </Text>
          </Box>
        ) : null}
        {shown.length === 0 && <Text dimColor>No usage limits</Text>}
        {shown.map(l => (
          <Box key={l.kind} flexDirection="column">
            <Text color={colorFor(l.percentUsed)}>
              {LABELS[l.kind]} {bar(l.percentUsed)} {Math.round(l.percentUsed)}%
            </Text>
            {l.resetsAt ? <Text dimColor>{until(l.resetsAt, at)}</Text> : null}
          </Box>
        ))}
        <Box flexDirection="column">
          <Text bold={running.length > 0} dimColor={running.length === 0}>
            {running.length === 0 ? 'No agents running' : `Agents ${running.length}`}
          </Text>
          {running.map(a => (
            <Text key={a.id} dimColor>
              · {clip(a.label, COLUMNS - 2)}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
