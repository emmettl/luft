// Operating callsign families, checked against FAA JO 7340.2, Chapter 3 §3,
// on 2026-09-16. A callsign association is not a fleet ownership or codeshare claim.
export const AIRLINES = [
  { id: 'easyjet', name: 'easyJet', prefixes: ['EZY', 'EJU', 'EZS'], note: 'UK, Europe and Switzerland operators' },
  { id: 'swiss', name: 'SWISS', prefixes: ['SWR'], note: 'SWISS operating callsigns' },
  { id: 'british-airways', name: 'British Airways', prefixes: ['BAW', 'SHT', 'CFE', 'EFW'], note: 'BA, Shuttle, CityFlyer and Euroflyer' },
] as const
export type AirlineId = typeof AIRLINES[number]['id']
export type AirlineSelection = AirlineId | 'all'
type TrackIdentity = { callsign: string; icaoAddress?: string }
export function airlineForTrack(track: TrackIdentity): AirlineId | undefined {
  const callsign = track.callsign.trim().toUpperCase()
  if (callsign === track.icaoAddress?.toUpperCase()) return undefined
  if (!/^[A-Z]{3}[A-Z0-9]{1,5}$/.test(callsign)) return undefined
  const prefix = callsign.slice(0, 3)
  return AIRLINES.find(airline => (airline.prefixes as readonly string[]).includes(prefix))?.id
}
export function matchesAirline(track: TrackIdentity, selection: AirlineSelection) {
  return selection === 'all' || airlineForTrack(track) === selection
}
export type AirlineSummary = {
  aircraft: number
  samples: number
  bins: {time: number; count: number}[]
  cells: number[][][]
}
export type AirlineSummaries = {date: string; sourceManifestSha256: string; airlines: Record<AirlineId, AirlineSummary>}
