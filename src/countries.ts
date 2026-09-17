export type Country={code:string;name:string;aliases:string[];polygons:number[][][][];airports:string[];searchable?:boolean}
export type CountryIndex={source:{sourceManifestSha256:string};countries:Country[]}
const normalize=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()
export function searchCountries(countries:readonly Country[],query:string){
 const q=normalize(query)
 if(!q)return countries.filter(c=>['CH','GB','FR','DE'].includes(c.code))
 const score=(country:Country)=>Math.min(...[country.name,country.code,...country.aliases].map(normalize).map(name=>name===q?0:name.startsWith(q)?1:name.includes(q)?2:3))
 return countries.filter(c=>c.searchable!==false).map(country=>({country,score:score(country)})).filter(c=>c.score<3).sort((a,b)=>a.score-b.score||a.country.name.localeCompare(b.country.name)).map(c=>c.country)
}
export function countryAirportIds(countries:readonly Country[],codes:readonly string[]){
 return new Set(countries.filter(c=>codes.includes(c.code)).flatMap(c=>c.airports))
}
