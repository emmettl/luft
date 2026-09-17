import {expect,it} from 'vitest'
import {EMPTY_SELECTION,type Selection} from './filters'
import {selectionFromHash,selectionHash,type SelectionOptions} from './selection-url'

const options:SelectionOptions={airlines:new Set(['swiss','easyjet']),airports:new Set(['LSZH','EGLL']),routes:new Set(['EGLL|LSZH']),countries:new Set(['CH','GB']),continents:new Set(['EU'])}
it('round-trips multiple values in every selection group',()=>{
 const selection:Selection={airlines:['swiss','easyjet'],airports:['LSZH','EGLL'],routes:['EGLL|LSZH'],countries:['CH','GB'],continents:['EU']}
 expect(selectionFromHash(selectionHash(selection),options)).toEqual(selection)
 expect(selectionHash(EMPTY_SELECTION)).toBe('')
 expect(selectionFromHash('',options)).toEqual(EMPTY_SELECTION)
})
it('normalizes case and bidirectional routes, deduplicates and ignores unknown values',()=>{
 const hash='#airlines=SWISS,unknown,swiss&airlines=easyjet&airports=lszh,ZZZZ&routes=lszh%7Cegll,FAKE%7CROUTE&countries=ch,INVALID&continents=eu,XX&unrelated=value'
 expect(selectionFromHash(hash,options)).toEqual({airlines:['swiss','easyjet'],airports:['LSZH'],routes:['EGLL|LSZH'],countries:['CH'],continents:['EU']})
})
it('tolerates malformed fragments and leaves empty selection arrays untouched',()=>{
 expect(selectionFromHash('#countries=%E0%A4%A&routes=%&airlines=,,,',options)).toEqual(EMPTY_SELECTION)
 expect(selectionFromHash('#about',options)).toEqual(EMPTY_SELECTION)
 expect(EMPTY_SELECTION).toEqual({airlines:[],airports:[],routes:[],countries:[],continents:[]})
})
