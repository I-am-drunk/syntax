import type { GeoLesson } from '../pageTypes'
import { UNIT2_LEVEL_1 } from './unit2Level1'
import { UNIT2_LEVEL2 } from './unit2Level2'
import { UNIT2_CONFERENCE } from './unit2Conference'
import { UNIT2_MOCK } from './unit2Mock'

export const UNIT2_LESSONS: GeoLesson[] = [
  ...UNIT2_LEVEL_1,
  ...UNIT2_LEVEL2,
  ...UNIT2_CONFERENCE,
  ...UNIT2_MOCK,
]
