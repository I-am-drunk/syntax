import { initializeApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  GithubAuthProvider,
  type Auth,
  type User,
} from 'firebase/auth'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { syntaxLog } from './logger'

export type ConnectedAI = {
  id: 'claude' | 'chatgpt' | 'cursor'
  name: string
  mode: 'link-mode' | 'mcp-connector'
  connected: boolean
  lastSyncedAt?: string
}

export type SyntaxAccount = {
  id: string
  handle: string
  displayName: string
  email?: string
  photoURL?: string
  bio: string
  avatarColor: string
  provider: 'firebase-google' | 'firebase-github' | 'firebase-email' | 'local-preview'
  createdAt: string
  connectedAIs: ConnectedAI[]
}

const AVATAR_COLORS = ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899', '#14b8a6']

const DEFAULT_AIS: ConnectedAI[] = [
  { id: 'claude', name: 'Claude', mode: 'mcp-connector', connected: false },
  { id: 'chatgpt', name: 'ChatGPT', mode: 'mcp-connector', connected: false },
  { id: 'cursor', name: 'Cursor / MCP Client', mode: 'link-mode', connected: false },
]

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
}

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId,
)

let firebaseApp: FirebaseApp | null = null
let firebaseAuth: Auth | null = null

function getFirebaseAuth(): Auth | null {
  if (!isFirebaseConfigured) return null
  if (firebaseAuth) return firebaseAuth
  firebaseApp = getApps()[0] ?? initializeApp(firebaseConfig)
  firebaseAuth = getAuth(firebaseApp)
  return firebaseAuth
}

export function sanitizeHandle(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^@+/, '')
    .replace(/[^a-z0-9_-]/g, '')
    .slice(0, 24)
}

function pickAvatarColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

function mapFirebaseUser(user: User, existing?: SyntaxAccount | null): SyntaxAccount {
  // Only carry over local customizations if they belong to the exact same UID
  const prev = existing?.id === user.uid ? existing : null

  const providerId = user.providerData[0]?.providerId ?? 'password'
  const provider: SyntaxAccount['provider'] =
    providerId === 'google.com'
      ? 'firebase-google'
      : providerId === 'github.com'
        ? 'firebase-github'
        : 'firebase-email'

  const derivedHandle =
    sanitizeHandle(
      prev?.handle ||
        user.email?.split('@')[0] ||
        user.displayName?.replace(/\s+/g, '') ||
        user.uid.slice(0, 10),
    ) || 'learner'

  return {
    id: user.uid,
    handle: derivedHandle,
    displayName: user.displayName || prev?.displayName || derivedHandle,
    email: user.email ?? undefined,
    photoURL: user.photoURL ?? undefined,
    bio: prev?.bio || 'Learning interactively on Syntax.',
    avatarColor: prev?.avatarColor || pickAvatarColor(derivedHandle),
    provider,
    createdAt: user.metadata.creationTime || prev?.createdAt || new Date().toISOString(),
    connectedAIs: prev?.connectedAIs ?? DEFAULT_AIS.map(ai => ({ ...ai })),
  }
}

type AuthResult = { ok: true; account: SyntaxAccount } | { ok: false; error: string }

type AccountStoreState = {
  account: SyntaxAccount | null
  busy: boolean
  signInWithOAuth: (provider: 'google' | 'github') => Promise<AuthResult>
  signInWithEmail: (
    email: string,
    password: string,
    mode: 'signin' | 'signup',
    displayName?: string,
  ) => Promise<AuthResult>
  signInPreview: (handle: string, displayName: string, bio?: string) => AuthResult
  signOut: () => Promise<void>
  updateAccountProfile: (
    patch: Partial<Pick<SyntaxAccount, 'displayName' | 'bio' | 'avatarColor' | 'handle'>>,
  ) => Promise<{ ok: true } | { ok: false; error: string }>
  toggleConnectedAI: (aiId: ConnectedAI['id']) => void
}

export const useAccountStore = create<AccountStoreState>()(
  persist(
    (set, get) => ({
      account: null,
      busy: false,

      signInWithOAuth: async provider => {
        const auth = getFirebaseAuth()
        if (!auth) {
          return { ok: false, error: 'Firebase Auth is not configured on this deployment yet.' }
        }
        set({ busy: true })
        try {
          const authProvider =
            provider === 'google' ? new GoogleAuthProvider() : new GithubAuthProvider()
          const result = await signInWithPopup(auth, authProvider)
          const account = mapFirebaseUser(result.user, get().account)
          set({ account, busy: false })
          syntaxLog.info('account', `Signed in with ${provider} as @${account.handle}`)
          return { ok: true, account }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Sign-in was cancelled.'
          syntaxLog.warn('account', `OAuth sign-in failed (${provider})`, msg)
          set({ busy: false })
          return { ok: false, error: msg }
        }
      },

      signInWithEmail: async (email, password, mode, displayName) => {
        const auth = getFirebaseAuth()
        if (!auth) {
          return { ok: false, error: 'Firebase Auth is not configured on this deployment yet.' }
        }
        set({ busy: true })
        try {
          const cred =
            mode === 'signup'
              ? await createUserWithEmailAndPassword(auth, email.trim(), password)
              : await signInWithEmailAndPassword(auth, email.trim(), password)

          if (mode === 'signup' && displayName?.trim()) {
            await updateProfile(cred.user, { displayName: displayName.trim() })
          }
          const account = mapFirebaseUser(cred.user, get().account)
          set({ account, busy: false })
          syntaxLog.info('account', `Signed in via email as @${account.handle}`)
          return { ok: true, account }
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Could not sign in with email.'
          syntaxLog.warn('account', 'Email auth failed', msg)
          set({ busy: false })
          return { ok: false, error: msg }
        }
      },

      signInPreview: (rawHandle, rawDisplayName, bio) => {
        const handle = sanitizeHandle(rawHandle)
        const displayName = rawDisplayName.trim()
        if (handle.length < 2) {
          return { ok: false, error: 'Handle must be at least 2 letters or numbers.' }
        }
        if (displayName.length < 1) {
          return { ok: false, error: 'Display name is required.' }
        }
        const account: SyntaxAccount = {
          id: `local_${handle}`,
          handle,
          displayName,
          bio: (bio ?? '').trim() || 'Learning interactively on Syntax.',
          avatarColor: pickAvatarColor(handle),
          provider: 'local-preview',
          createdAt: new Date().toISOString(),
          connectedAIs: DEFAULT_AIS.map(ai => ({ ...ai })),
        }
        set({ account })
        syntaxLog.info('account', `Signed in (local preview) as @${account.handle}`)
        return { ok: true, account }
      },

      signOut: async () => {
        const prev = get().account?.handle
        const auth = getFirebaseAuth()
        if (auth) {
          try {
            await firebaseSignOut(auth)
          } catch (err) {
            syntaxLog.warn('account', 'Firebase signOut failed', err)
          }
        }
        set({ account: null })
        syntaxLog.info('account', `Signed out${prev ? ` (@${prev})` : ''}`)
      },

      updateAccountProfile: async patch => {
        const current = get().account
        if (!current) return { ok: false, error: 'Not signed in.' }

        let nextHandle = current.handle
        if (patch.handle !== undefined) {
          const cleaned = sanitizeHandle(patch.handle)
          if (cleaned.length < 2) {
            return { ok: false, error: 'Handle must be at least 2 letters or numbers.' }
          }
          nextHandle = cleaned
        }

        const nextDisplayName =
          patch.displayName !== undefined ? patch.displayName.trim() : current.displayName
        if (nextDisplayName.length < 1) {
          return { ok: false, error: 'Display name is required.' }
        }

        const next: SyntaxAccount = {
          ...current,
          handle: nextHandle,
          displayName: nextDisplayName,
          bio: patch.bio !== undefined ? patch.bio.trim() : current.bio,
          avatarColor: patch.avatarColor ?? current.avatarColor,
        }
        const auth = getFirebaseAuth()
        if (auth?.currentUser && patch.displayName) {
          try {
            await updateProfile(auth.currentUser, { displayName: nextDisplayName })
          } catch (err) {
            syntaxLog.warn('account', 'Failed to sync displayName to Firebase', err)
          }
        }
        set({ account: next })
        syntaxLog.info('account', 'Updated profile details', { handle: next.handle })
        return { ok: true }
      },

      toggleConnectedAI: aiId => {
        const current = get().account
        if (!current) return
        const nextAIs = current.connectedAIs.map(ai =>
          ai.id === aiId
            ? {
                ...ai,
                connected: !ai.connected,
                lastSyncedAt: !ai.connected ? new Date().toISOString() : ai.lastSyncedAt,
              }
            : ai,
        )
        set({ account: { ...current, connectedAIs: nextAIs } })
        syntaxLog.info('account', `Toggled AI connector: ${aiId}`)
      },
    }),
    {
      name: 'syntax-account-v2',
      partialize: state => ({ account: state.account }),
    },
  ),
)

let authListenerAttached = false

export function initSyntaxAuth() {
  if (authListenerAttached) return
  authListenerAttached = true
  const auth = getFirebaseAuth()
  if (!auth) return
  onAuthStateChanged(auth, user => {
    const existing = useAccountStore.getState().account
    if (user) {
      useAccountStore.setState({
        account: mapFirebaseUser(user, existing),
      })
    } else if (existing?.provider !== 'local-preview') {
      useAccountStore.setState({ account: null })
    }
  })
}

export function getSyntaxAccount(): SyntaxAccount | null {
  return useAccountStore.getState().account
}

export function useSyntaxAccount(): SyntaxAccount | null {
  return useAccountStore(s => s.account)
}
