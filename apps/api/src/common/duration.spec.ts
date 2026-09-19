import { durationToMs } from './duration'

describe('durationToMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['2h', 7_200_000],
    ['30d', 2_592_000_000],
  ])('converts %s', (input, expected) => {
    expect(durationToMs(input)).toBe(expected)
  })

  it.each(['', '15', 'm', '15 minutes', '-5m', '1w'])('rejects %p', (input) => {
    expect(() => durationToMs(input)).toThrow(/Unsupported duration/)
  })
})
