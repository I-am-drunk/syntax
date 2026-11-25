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

const STORAGE_KEY = 'syntax.account.v2'

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
  account: SyntaxAccount | null
  syncClerkUser: (user: SyntaxAccount | null) => void
  signInLocal: (handle: string, displayName: string) => SyntaxAccount
  signOutLocal: () => void
}

export const useAccountStore = create<AccountState>()(
  persist(
    set => ({
      account: null,

      syncClerkUser(user) {
        set({ account: user })
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
        set({ account: next })
        syntaxLog.info('account', `Signed in locally as @${handle}`)
        return next
      },

      signOutLocal() {
        set({ account: null })
        syntaxLog.info('account', 'Signed out')
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: state => ({
        account: state.account?.provider === 'local' ? state.account : null,
      }),
    },
  ),
)

export function getSyntaxAccount(): SyntaxAccount | null {
  return useAccountStore.getState().account
}

export function useAccount(): SyntaxAccount | null {
  return useAccountStore(s => s.account)
}
