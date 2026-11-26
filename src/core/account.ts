import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syntaxLog } from './logger'

export interface SyntaxAccount {
  uid: string
  handle: string
  displayName: string
  email?: string
  avatarUrl?: string
  provider: 'clerk' | 'local'
  createdAt: string
}

export type SessionStatus = 'hydrating' | 'ready' | 'signed-out'

const STORAGE_KEY = 'syntax.account.v3'

export function isClerkConfigured(): boolean {
  const key = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '').trim()
  return key.startsWith('pk_')
}

export function sanitizeHandle(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-_]/g, '')
    .slice(0, 28)
}

interface AccountState {
  // Persisted display profile so page refreshes show the exact avatar/name on frame 0 with zero flash.
  account: SyntaxAccount | null
  sessionStatus: SessionStatus
  syncClerkUser: (user: SyntaxAccount | null) => void
  setSessionStatus: (status: SessionStatus) => void
  signInLocal: (handle: string, displayName: string) => SyntaxAccount
  signOutLocal: () => void
}

export const useAccountStore = create<AccountState>()(
  persist(
    (set, get) => ({
      account: null,
      sessionStatus: isClerkConfigured() ? 'hydrating' : 'ready',

      syncClerkUser(user) {
        if (user) {
          set({ account: user, sessionStatus: 'ready' })
          return
        }
        // Only clear Clerk accounts; never wipe an explicit local account.
        const current = get().account
        if (current?.provider === 'local') {
          set({ sessionStatus: 'ready' })
          return
        }
        set({ account: null, sessionStatus: 'signed-out' })
      },

      setSessionStatus(status) {
        set({ sessionStatus: status })
      },

      signInLocal(rawHandle, rawDisplayName) {
        const handle = sanitizeHandle(rawHandle)
        if (handle.length < 2) {
          throw new Error('Pick a handle with at least 2 letters or numbers.')
        }
        const displayName = rawDisplayName.trim().slice(0, 48) || handle
        const next: SyntaxAccount = {
          uid: `local-${handle}`,
          handle,
          displayName,
          provider: 'local',
          createdAt: new Date().toISOString(),
        }
        set({ account: next, sessionStatus: 'ready' })
        syntaxLog.info('account', `Signed in locally as @${handle}`)
        return next
      },

      signOutLocal() {
        set({ account: null, sessionStatus: 'signed-out' })
        syntaxLog.info('account', 'Signed out')
      },
    }),
    {
      name: STORAGE_KEY,
      // Persist both local and cached Clerk display identity to eliminate avatar flash on reload.
      partialize: state => ({
        account: state.account,
      }),
      merge: (persisted, current) => {
        const saved = persisted as Partial<AccountState> | undefined
        const savedAccount = saved?.account ?? null
        if (!isClerkConfigured() && savedAccount?.provider === 'clerk') {
          return {
            ...current,
            account: null,
            sessionStatus: 'signed-out',
          }
        }
        return {
          ...current,
          account: savedAccount,
        }
      },
    },
  ),
)

export function getSyntaxAccount(): SyntaxAccount | null {
  return useAccountStore.getState().account
}

export function useAccount(): SyntaxAccount | null {
  return useAccountStore(s => s.account)
}

export function useSessionStatus(): SessionStatus {
  return useAccountStore(s => s.sessionStatus)
}
