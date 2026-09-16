import { AIRLINES, airlineForTrack, type AirlineId, type AirlineSummary } from './airlines.ts'
import type { AirTrack } from '@motionstudies/core/domain/air'
export function createAirlineAccumulator() {
  return Object.fromEntries(AIRLINES.map(({id}) => [id, {
    aircraft: new Set<string>(), samples: 0,
    bins: Array.from({length:288}, () => new Set<string>()),
    cells: Array.from({length:24}, () => new Map<string, number>()),
  }])) as Record<AirlineId, {aircraft: Set<string>; samples: number; bins: Set<string>[]; cells: Map<string, number>[]}>
}
// Count only the chunk's half-open window, not the trail/forward overlap. Snapshot
// bins count distinct aircraft with an observation exactly at each five-minute tick.
export function accumulateAirlines(accumulator: ReturnType<typeof createAirlineAccumulator>, tracks: readonly AirTrack[], start: number, end: number) {
  const seen = new Set<string>()
  for (const track of tracks) {
    const id = airlineForTrack(track)
    if (!id) continue
    const summary = accumulator[id], identity = track.icaoAddress ?? track.id
    for (const p of track.samples) {
      const time = p[0]
      if (time < start || time >= end) continue
      const sampleKey = `${identity}:${time}`
      if (seen.has(sampleKey)) throw new Error('Duplicate aircraft-time observation in airline summary')
      seen.add(sampleKey)
      summary.aircraft.add(identity); summary.samples++
      if (time % 300 === 0) summary.bins[time / 300].add(identity)
      const grid = summary.cells[Math.floor(time / 3600)], key = `${Math.floor(p[1]*2)/2},${Math.floor(p[2]*2)/2}`
      grid.set(key, (grid.get(key) ?? 0) + 1)
    }
  }
}
export function finishAirlines(accumulator: ReturnType<typeof createAirlineAccumulator>) {
  return Object.fromEntries(AIRLINES.map(({id}) => {
    const summary = accumulator[id]
    return [id, {aircraft: summary.aircraft.size, samples: summary.samples,
      bins: summary.bins.map((ids, i) => ({time: i*300, count: ids.size})),
      cells: summary.cells.map(grid => [...grid].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([key, count]) => [...key.split(',').map(Number), count])),
    }]
  })) as Record<AirlineId, AirlineSummary>
}
