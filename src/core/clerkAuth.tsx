import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ClerkProvider, UserButton, useClerk, useUser } from '@clerk/react'
import { dark } from '@clerk/themes'
import { isClerkConfigured, sanitizeHandle, useAccountStore } from './account'
import { syntaxLog } from './logger'

interface AuthActions {
  isClerkActive: boolean
  isLoaded: boolean
  openSignIn: () => void
  openAccount: () => void
  signOut: () => Promise<void>
}

const AuthActionsContext = createContext<AuthActions>({
  isClerkActive: false,
  isLoaded: true,
  openSignIn: () => {},
  openAccount: () => {},
  signOut: async () => {},
})

export function useAuthActions(): AuthActions {
  return useContext(AuthActionsContext)
}

function useDocumentDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark',
  )
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.dataset.theme === 'dark')
    read()
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

function ClerkAccountBridge({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser()
  const clerk = useClerk()
  const syncClerkUser = useAccountStore(s => s.syncClerkUser)

  useEffect(() => {
    if (!isLoaded) return
    if (!user) {
      syncClerkUser(null)
      return
    }
    const email = user.primaryEmailAddress?.emailAddress
    const rawHandle =
      user.username ||
      (email ? email.split('@')[0] : '') ||
      user.firstName ||
      'learner'
    const handle = sanitizeHandle(rawHandle) || 'learner'
    const displayName = user.fullName || user.firstName || user.username || handle
    syncClerkUser({
      uid: user.id,
      handle,
      displayName,
      email,
      avatarUrl: user.imageUrl || undefined,
      provider: 'clerk',
      createdAt: user.createdAt ? user.createdAt.toISOString() : new Date().toISOString(),
    })
    syntaxLog.info('account', `Clerk session active for @${handle}`)
  }, [user, isLoaded, syncClerkUser])

  const actions = useMemo<AuthActions>(
    () => ({
      isClerkActive: true,
      isLoaded,
      openSignIn: () => {
        clerk.openSignIn()
      },
      openAccount: () => {
        if (user) clerk.openUserProfile()
        else clerk.openSignIn()
      },
      signOut: async () => {
        await clerk.signOut()
        syncClerkUser(null)
      },
    }),
    [clerk, isLoaded, user, syncClerkUser],
  )

  return <AuthActionsContext.Provider value={actions}>{children}</AuthActionsContext.Provider>
}

export function ClerkHeaderAvatar() {
  const { isClerkActive } = useAuthActions()
  if (!isClerkActive) return null
  return (
    <UserButton
      appearance={{
        elements: {
          avatarBox: { width: 32, height: 32 },
        },
      }}
    />
  )
}

export function SyntaxAuthProvider({
  children,
  onOpenLocalSignIn,
}: {
  children: ReactNode
  onOpenLocalSignIn: () => void
}) {
  const isDark = useDocumentDarkMode()
  const publishableKey = (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ?? '').trim()
  const clerkEnabled = isClerkConfigured()
  const signOutLocal = useAccountStore(s => s.signOutLocal)
  const basePath = import.meta.env.BASE_URL || '/'

  const localActions = useMemo<AuthActions>(
    () => ({
      isClerkActive: false,
      isLoaded: true,
      openSignIn: onOpenLocalSignIn,
      openAccount: onOpenLocalSignIn,
      signOut: async () => {
        signOutLocal()
      },
    }),
    [onOpenLocalSignIn, signOutLocal],
  )

  if (!clerkEnabled) {
    return (
      <AuthActionsContext.Provider value={localActions}>
        {children}
      </AuthActionsContext.Provider>
    )
  }

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      signInFallbackRedirectUrl={basePath}
      signUpFallbackRedirectUrl={basePath}
      afterSignOutUrl={basePath}
      allowedRedirectOrigins={[
        'https://i-am-drunk.github.io',
        'http://localhost:5173',
        'http://127.0.0.1:5173',
      ]}
      appearance={{
        theme: isDark ? dark : undefined,
        variables: {
          colorPrimary: '#456dff',
          colorBackground: isDark ? '#171717' : '#ffffff',
          colorInput: isDark ? '#202020' : '#f8f8f8',
          colorForeground: isDark ? '#ffffff' : '#141414',
          borderRadius: '14px',
          fontFamily: "'CoFo Brilliant', system-ui, -apple-system, sans-serif",
        },
      }}
    >
      <ClerkAccountBridge>{children}</ClerkAccountBridge>
    </ClerkProvider>
  )
}
