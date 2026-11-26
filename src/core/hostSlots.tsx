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
  setContribution: (next: CourseSlotContribution) => void
  clearContribution: () => void
}

const HostSlotsContext = createContext<HostSlotsContextValue>({
  contribution: {},
  setContribution: () => {},
  clearContribution: () => {},
})

export function HostSlotsProvider({ children }: { children: ReactNode }) {
  const [contribution, setContributionState] = useState<CourseSlotContribution>({})

  const setContribution = useCallback((next: CourseSlotContribution) => {
    setContributionState(next)
  }, [])

  const clearContribution = useCallback(() => {
    setContributionState({})
  }, [])

  const value = useMemo(
    () => ({ contribution, setContribution, clearContribution }),
    [contribution, setContribution, clearContribution],
  )

  return <HostSlotsContext.Provider value={value}>{children}</HostSlotsContext.Provider>
}

export function useHostSlots(): HostSlotsContextValue {
  return useContext(HostSlotsContext)
}
