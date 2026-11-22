/** @typedef {'system' | 'light' | 'dark'} ColorMode */
/** @typedef {'system' | 'on' | 'off'} MotionPreference */
/** @typedef {'melodic' | 'deep'} Voice */
/** @typedef {{colorMode: ColorMode, motion: MotionPreference, narration: boolean,
 * voice: Voice, soundEffects: boolean, streakReminders: boolean,
 * streakAlerts: boolean, leagueReminders: boolean, leagueAlerts: boolean,
 * dailyPractice: boolean, recommendations: boolean, newsletters: boolean,
 * contentLaunches: boolean, promotions: boolean, unsubscribeAll: boolean}} Preferences */

/** @type {Readonly<Preferences>} */
export const defaultPreferences = Object.freeze({
  colorMode: 'system', motion: 'system', narration: true, voice: 'deep',
  soundEffects: true, streakReminders: true, streakAlerts: true,
  leagueReminders: true, leagueAlerts: true, dailyPractice: true,
  recommendations: true, newsletters: true, contentLaunches: true,
  promotions: true, unsubscribeAll: false,
})

/** @param {unknown} value @returns {Partial<Preferences>} */
export function parsePreferencePatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Preferences must be an object.')
  const choices = { colorMode: ['system', 'light', 'dark'],
    motion: ['system', 'on', 'off'], voice: ['melodic', 'deep'] }
  for (const [key, item] of Object.entries(value)) {
    if (!Object.hasOwn(defaultPreferences, key)) throw new Error(`Unknown preference: ${key}`)
    const options = key === 'colorMode' ? choices.colorMode
      : key === 'motion' ? choices.motion : key === 'voice' ? choices.voice : null
    if (options ? typeof item !== 'string' || !options.includes(item) : typeof item !== 'boolean')
      throw new Error(`Invalid preference: ${key}`)
  }
  return /** @type {Partial<Preferences>} */ ({...value})
}
