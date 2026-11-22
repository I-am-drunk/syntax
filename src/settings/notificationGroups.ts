import type { Preferences } from '../services/preferences'

export type BooleanPreference = { [K in keyof Preferences]: Preferences[K] extends boolean ? K : never }[keyof Preferences]
export const notificationGroups: { title: string; items: { key: BooleanPreference; title: string }[] }[] = [
  { title: 'Streaks', items: [
    { key: 'streakReminders', title: 'Reminders (during the day)' },
    { key: 'streakAlerts', title: 'Alerts (warnings when your streak is about to expire)' },
  ] },
  { title: 'Leagues', items: [
    { key: 'leagueReminders', title: 'Reminders (throughout the week)' },
    { key: 'leagueAlerts', title: "Alerts (sent when Leagues are closing, or you're at risk of demotion)" },
  ] },
  { title: 'Learning Reminders', items: [
    { key: 'dailyPractice', title: 'Daily practice' },
    { key: 'recommendations', title: 'Personalized course recommendations' },
  ] },
  { title: 'News and Announcements', items: [
    { key: 'newsletters', title: 'Monthly newsletters' },
    { key: 'contentLaunches', title: 'Content launches' },
    { key: 'promotions', title: 'Promotions' },
  ] },
]
