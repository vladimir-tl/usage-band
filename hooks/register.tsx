import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Limit } from '../types'

const limits = atom({ plugin: 'usage-band', key: 'limits' } as const, [] as Limit[])
const now = atom({ plugin: 'usage-band', key: 'now' } as const, 0)
const model = atom({ plugin: 'usage-band', key: 'model' } as const, '')

const LABELS: Record<string, string> = { five_hour: '5h', seven_day: 'Week' }
const WIDTH = 10

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
  return ` · resets in ${left}`
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
    const refresh = async () => {
      const usage = await $.session.usage()
      await update($, limits, () => usage.rateLimits)
      const current = await $.session.model()
      await update($, model, () => current)
      const t = await $.clock.now()
      await update($, now, () => t)
    }
    await refresh()
    $.clock.every(60_000, refresh)

    return next(e)
  })

  // A /model switch shows by the next prompt at the latest, else on the minute.
  on('prompt.submit', async ($, e, next) => {
    // Never hold up the prompt over the band.
    await $.session
      .model()
      .then(current => update($, model, () => current))
      .catch(() => undefined)

    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, limits, () => e.rateLimits)
    const t = await $.clock.now()
    await update($, now, () => t)

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const shown = (await read($, limits)).filter(l => l.kind in LABELS)
    const current = await read($, model)
    if (e.props.hasSurvey || (shown.length === 0 && !current)) {
      return next(e)
    }

    const at = await read($, now)
    const { Box, Text } = $.ui.resolve(e)

    return (
      <Box gap={4}>
        {current ? <Text key="model" bold>{modelName(current)}</Text> : null}
        {shown.map(l => (
          <Text key={l.kind} color={l.percentUsed >= 90 ? 'red' : l.percentUsed >= 70 ? 'yellow' : undefined} dimColor={l.percentUsed < 70}>
            {LABELS[l.kind]} {bar(l.percentUsed)} {Math.round(l.percentUsed)}%{until(l.resetsAt, at)}
          </Text>
        ))}
      </Box>
    )
  })
}
