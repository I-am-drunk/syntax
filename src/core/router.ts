import { useHashLocation } from 'wouter/use-hash-location'

export const SYNTAX_PATHS = {
  home: '/',
  hub: '/hub',
  plugins: '/plugins',
  profile: '/profile',
  course: (courseId: string) => `/course/${courseId}`,
} as const

/**
 * Normalizes legacy MPM2D direct lesson hashes like `#lesson=l1-slope` or `#lesson/l1-slope`
 * into the standard Wouter hash route `/course/mpm2d-analytic-geometry`
 * so CourseShell stays mounted and opens the lesson immediately.
 */
export function useSyntaxLocation(): [string, (to: string, options?: { replace?: boolean }) => void] {
  const [location, navigate] = useHashLocation()
  if (/^\/?lesson[=/]/i.test(location)) {
    return ['/course/mpm2d-analytic-geometry', navigate]
  }
  return [location, navigate]
}
