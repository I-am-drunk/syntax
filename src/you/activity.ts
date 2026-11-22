import type { SavedActivity } from '../services/activity'

export function localDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function projectActivity({ records }: SavedActivity) {
  return records.map(({ progress, savedAt }) => ({
    id: progress.id, date: localDate(new Date(savedAt)),
    activities: progress.contents.filter(content => content.completed).length,
    correct: progress.contents.reduce((sum, content) => sum + content.problems.filter(p => p.state === 'correct').length, 0),
    practiceCorrect: progress.contents.filter(c => c.kind === 'practice')
      .reduce((sum, c) => sum + c.problems.filter(p => p.state === 'correct').length, 0),
    practiceAnswered: progress.contents.filter(c => c.kind === 'practice')
      .reduce((sum, c) => sum + c.problems.length, 0),
  }))
}

export type ActivitySession = ReturnType<typeof projectActivity>[number]
export function totalActivity(sessions: ActivitySession[], start: string, end: string) {
  const selected = sessions.filter(s => s.date >= start && s.date <= end)
  const sum = (key: 'activities' | 'correct' | 'practiceCorrect' | 'practiceAnswered') =>
    selected.reduce((total, session) => total + session[key], 0)
  const answered = sum('practiceAnswered')
  return { activities: sum('activities'), correct: sum('correct'),
    accuracy: answered ? sum('practiceCorrect') / answered : null }
}
