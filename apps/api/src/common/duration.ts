const UNITS: Record<string, number> = {
  s: 1_000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
}

/**
 * Turns the JWT-style durations in the environment ("15m", "30d") into
 * milliseconds, so the cookie lifetime and the token lifetime come from one
 * value instead of drifting apart.
 */
export function durationToMs(value: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(value.trim())
  if (!match) {
    throw new Error(`Unsupported duration: "${value}". Use a form like "15m" or "30d".`)
  }

  const [, amount, unit] = match
  return Number(amount) * (UNITS[unit as string] as number)
}
