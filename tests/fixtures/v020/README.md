# LUFT 0.2.0 renderer baseline

These three files are copied from commit `1e55fa2381405acbf29ce4edfae3f21d53237fca` for the opt-in GPU comparison profile. Only the `map.ts` type-only data import is adjusted for its fixture location. The application never imports them. Keeping the released path available lets one browser replay identical data/timestamps against Canvas, the old GPU path and the current GPU path without deploying an old build.
