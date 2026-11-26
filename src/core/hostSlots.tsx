import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

export interface CourseNavTab {
  id: string
  label: string
  icon?: ReactNode
  active?: boolean
  onClick: () => void
}

export interface CourseMenuAction {
  id: string
  label: string
  onSelect: () => void
}

export interface CourseSlotContribution {
  courseNavTabs?: CourseNavTab[]
  headerAction?: ReactNode
  menuActions?: CourseMenuAction[]
}

interface HostSlotsContextValue {
  contribution: CourseSlotContribution
  isFullscreenLesson: boolean
  setContribution: (next: CourseSlotContribution) => void
  clearContribution: () => void
  setFullscreenLesson: (active: boolean) => void
}

const HostSlotsContext = createContext<HostSlotsContextValue>({
  contribution: {},
  isFullscreenLesson: false,
  setContribution: () => {},
  clearContribution: () => {},
  setFullscreenLesson: () => {},
})

export function HostSlotsProvider({ children }: { children: ReactNode }) {
  const [contribution, setContributionState] = useState<CourseSlotContribution>({})
  const [isFullscreenLesson, setFullscreenLessonState] = useState(false)

  const setContribution = useCallback((next: CourseSlotContribution) => {
    setContributionState(next)
  }, [])

  const clearContribution = useCallback(() => {
    setContributionState({})
  }, [])

  const setFullscreenLesson = useCallback((active: boolean) => {
    setFullscreenLessonState(prev => (prev === active ? prev : active))
  }, [])

  const value = useMemo(
    () => ({
      contribution,
      isFullscreenLesson,
      setContribution,
      clearContribution,
      setFullscreenLesson,
    }),
    [contribution, isFullscreenLesson, setContribution, clearContribution, setFullscreenLesson],
  )

  return <HostSlotsContext.Provider value={value}>{children}</HostSlotsContext.Provider>
}

export function useHostSlots(): HostSlotsContextValue {
  return useContext(HostSlotsContext)
}
