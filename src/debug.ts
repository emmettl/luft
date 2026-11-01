import { editionDebugOptions, startEditionDebug } from '@motionstudies/three/debug'
export const gpuDebugEnabled = (() => { const o = editionDebugOptions(); return o.perf || o.capture })()
let state: Record<string, unknown> = {}
export function updateEditionDebugState(next: Record<string, unknown>) { if (gpuDebugEnabled) state = { ...state, ...next } }
let started: ReturnType<typeof startEditionDebug> | undefined
export function initializeEditionDebug() {
  return started ??= startEditionDebug({ edition: 'luft', build: __EDITION_BUILD__, metadata: () => state })
}
