// Operating callsign families, checked against FAA JO 7340.2, Chapter 3 §3,
// on 2026-09-16. A callsign association is not a fleet ownership or codeshare claim.
export const AIRLINES = [
  {id: "easyjet", name: "easyJet", prefixes: ["EZY", "EJU", "EZS"], note: "UK, Europe and Switzerland operators"},
  {id: "swiss", name: "SWISS", prefixes: ["SWR"], note: "SWISS operating callsigns"},
  {id: "british-airways", name: "British Airways", prefixes: ["BAW", "SHT", "CFE", "EFW"], note: "BA, Shuttle, CityFlyer and Euroflyer"},
  {id: "ryanair", name: "Ryanair", prefixes: ["RYR", "RUK", "MAY", "RYS", "LDA"], note: "Ryanair, UK, Malta Air, Buzz and Lauda Europe"},
  {id: "lufthansa", name: "Lufthansa", prefixes: ["DLH", "CLH", "LHX"], note: "Lufthansa, CityLine and City Airlines"},
  {id: "air-france", name: "Air France", prefixes: ["AFR", "HOP"], note: "Air France and HOP!"},
  {id: "klm", name: "KLM", prefixes: ["KLM", "KLC"], note: "KLM and Cityhopper"},
  {id: "wizz-air", name: "Wizz Air", prefixes: ["WZZ", "WMT", "WUK"], note: "Hungary, Malta and UK operators"},
  {id: "sas", name: "SAS", prefixes: ["SAS", "SZS"], note: "SAS and SAS Connect"},
  {id: "jet2", name: "Jet2", prefixes: ["EXS"], note: "Jet2 operating callsigns"},
  {id: "vueling", name: "Vueling", prefixes: ["VLG"], note: "Vueling operating callsigns"},
  {id: "eurowings", name: "Eurowings", prefixes: ["EWG", "EWL"], note: "Eurowings and Eurowings Europe"},
  {id: "turkish-airlines", name: "Turkish Airlines", prefixes: ["THY"], note: "Turkish Airlines operating callsigns"},
  {id: "pegasus", name: "Pegasus", prefixes: ["PGT"], note: "Pegasus operating callsigns"},
  {id: "tap", name: "TAP Air Portugal", prefixes: ["TAP"], note: "TAP operating callsigns"},
  {id: "iberia", name: "Iberia", prefixes: ["IBE"], note: "Iberia operating callsigns"},
  {id: "austrian", name: "Austrian", prefixes: ["AUA"], note: "Austrian operating callsigns"},
  {id: "finnair", name: "Finnair", prefixes: ["FIN"], note: "Finnair operating callsigns"},
  {id: "aegean", name: "Aegean", prefixes: ["AEE"], note: "Aegean operating callsigns"},
  {id: "ita", name: "ITA Airways", prefixes: ["ITY"], note: "ITA operating callsigns"},
  {id: "lot", name: "LOT Polish Airlines", prefixes: ["LOT"], note: "LOT operating callsigns"},
  {id: "brussels", name: "Brussels Airlines", prefixes: ["BEL"], note: "Brussels operating callsigns"},
  {id: "airbaltic", name: "airBaltic", prefixes: ["BTI"], note: "airBaltic operating callsigns"},
  {id: "aer-lingus", name: "Aer Lingus", prefixes: ["EIN"], note: "Aer Lingus operating callsigns"},
  {id: "edelweiss", name: "Edelweiss", prefixes: ["EDW"], note: "Edelweiss operating callsigns"},
  {id: "norwegian", name: "Norwegian", prefixes: ["NOZ", "NSZ"], note: "Norway and Sweden operators"},
  {id: "transavia", name: "Transavia", prefixes: ["TRA", "TVF"], note: "Netherlands and France operators"},
  {id: "condor", name: "Condor", prefixes: ["CFG"], note: "Condor operating callsigns"},
  {id: "emirates", name: "Emirates", prefixes: ["UAE"], note: "Emirates operating callsigns"},
  {id: "qatar", name: "Qatar Airways", prefixes: ["QTR"], note: "Qatar operating callsigns"},
  {id: "united", name: "United Airlines", prefixes: ["UAL"], note: "United operating callsigns"},
  {id: "delta", name: "Delta Air Lines", prefixes: ["DAL"], note: "Delta operating callsigns"},
  {id: "american", name: "American Airlines", prefixes: ["AAL"], note: "American operating callsigns"},
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
export type AirlineCatalogue = {date: string; sourceManifestSha256: string; airlines: Record<AirlineId, {aircraft: number}>}
export type AirlineData = {date: string; sourceManifestSha256: string; summary: AirlineSummary}
