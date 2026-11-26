import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ClerkProvider, useAuth, useClerk, useUser } from '@clerk/react'
import { dark } from '@clerk/themes'
import { isClerkConfigured, sanitizeHandle, useAccountStore } from './account'
import { syntaxLog } from './logger'

interface AuthActions {
  isClerkActive: boolean
  isLoaded: boolean
  isSignedIn: boolean
  openSignIn: () => void
  openAccount: () => void
  signOut: () => Promise<void>
}

const AuthActionsContext = createContext<AuthActions>({
  isClerkActive: false,
  isLoaded: true,
  isSignedIn: false,
  openSignIn: () => {},
  openAccount: () => {},
  signOut: async () => {},
})

const ALLOWED_REDIRECT_ORIGINS = [
  'https://i-am-drunk.github.io',
  'http://localhost:5189',
  'http://127.0.0.1:5189',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

export function useAuthActions(): AuthActions {
  return useContext(AuthActionsContext)
}

function useDocumentDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() =>
    typeof document !== 'undefined' && document.documentElement.dataset.theme === 'dark',
  )
  useEffect(() => {
    const read = () => setIsDark(document.documentElement.dataset.theme === 'dark')
    const obs = new MutationObserver(read)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => obs.disconnect()
  }, [])
  return isDark
}

function hasPendingClerkHandshake(): boolean {
  if (typeof window === 'undefined') return false
  const q = window.location.search
  return q.includes('__clerk_') || window.location.hash.includes('__clerk_')
}

function resolveBaseRedirectUrl(): string {
  const basePath = import.meta.env.BASE_URL || '/'
  if (typeof window === 'undefined') return basePath
  try {
    return new URL(basePath, window.location.origin).toString()
  } catch {
    return basePath
  }
}

function ClerkAccountBridge({ children }: { children: ReactNode }) {
  const { user, isLoaded: userLoaded } = useUser()
  const { isLoaded: authLoaded, isSignedIn } = useAuth()
  const clerk = useClerk()
  const syncClerkUser = useAccountStore(s => s.syncClerkUser)
  const setSessionStatus = useAccountStore(s => s.setSessionStatus)
  const signOutTimerRef = useRef<number>(0)
  const explicitSignOutRef = useRef(false)
  const isLoaded = Boolean(userLoaded && authLoaded)

  useEffect(() => {
    window.clearTimeout(signOutTimerRef.current)

    if (!isLoaded) {
      setSessionStatus('hydrating')
      return
    }

    if (user) {
      explicitSignOutRef.current = false
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
      return
    }

    // If user explicitly clicked Sign out, clear immediately.
    if (explicitSignOutRef.current) {
      syncClerkUser(null)
      return
    }

    // Guard against Clerk dev-instance transient null ticks during __clerk_db_jwt
    // cookie refreshes or URL handshakes so users are never falsely flashed as signed out.
    const cachedAccount = useAccountStore.getState().account
    if (cachedAccount?.provider === 'clerk') {
      const waitMs = hasPendingClerkHandshake() ? 1800 : 500
      signOutTimerRef.current = window.setTimeout(() => {
        if (!clerk.user && !clerk.session) {
          syntaxLog.info('account', 'Clerk session confirmed signed out')
          syncClerkUser(null)
        }
      }, waitMs)
      return () => window.clearTimeout(signOutTimerRef.current)
    }

    syncClerkUser(null)
    return () => window.clearTimeout(signOutTimerRef.current)
  }, [user, isLoaded, isSignedIn, clerk, syncClerkUser, setSessionStatus])

  const actions = useMemo<AuthActions>(
    () => ({
      isClerkActive: true,
      isLoaded,
      isSignedIn: Boolean(isSignedIn || user),
      openSignIn: () => {
        const redirectUrl = resolveBaseRedirectUrl()
        clerk.openSignIn({
          fallbackRedirectUrl: redirectUrl,
          signUpFallbackRedirectUrl: redirectUrl,
        })
      },
      openAccount: () => {
        if (user || clerk.user) {
          clerk.openUserProfile()
        } else {
          const redirectUrl = resolveBaseRedirectUrl()
          clerk.openSignIn({
            fallbackRedirectUrl: redirectUrl,
            signUpFallbackRedirectUrl: redirectUrl,
          })
        }
      },
      signOut: async () => {
        explicitSignOutRef.current = true
        window.clearTimeout(signOutTimerRef.current)
        syncClerkUser(null)
        try {
          await clerk.signOut({ redirectUrl: resolveBaseRedirectUrl() })
        } catch (err) {
          syntaxLog.warn('account', 'Clerk signOut completed with warning', {
            error: err instanceof Error ? err.message : String(err),
          })
        }
      },
    }),
    [clerk, isLoaded, isSignedIn, user, syncClerkUser],
  )

  return <AuthActionsContext.Provider value={actions}>{children}</AuthActionsContext.Provider>
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
  const localAccount = useAccountStore(s => s.account)
  const redirectUrl = useMemo(() => resolveBaseRedirectUrl(), [])

  const localActions = useMemo<AuthActions>(
    () => ({
      isClerkActive: false,
      isLoaded: true,
      isSignedIn: Boolean(localAccount),
      openSignIn: onOpenLocalSignIn,
      openAccount: onOpenLocalSignIn,
      signOut: async () => {
        signOutLocal()
      },
    }),
    [localAccount, onOpenLocalSignIn, signOutLocal],
  )

  const clerkAppearance = useMemo(
    () => ({
      theme: isDark ? dark : undefined,
      variables: {
        colorPrimary: '#456dff',
        colorBackground: isDark ? '#181818' : '#ffffff',
        colorInput: isDark ? '#222222' : '#f7f7f7',
        colorForeground: isDark ? '#ffffff' : '#141414',
        colorNeutral: isDark ? '#e5e5e5' : '#141414',
        borderRadius: '14px',
        fontFamily: "'CoFo Brilliant', -apple-system, BlinkMacSystemFont, sans-serif",
      },
      elements: {
        modalBackdrop: {
          backgroundColor: 'rgba(0, 0, 0, 0.54)',
          backdropFilter: 'blur(6px)',
        },
        cardBox: {
          boxShadow: isDark
            ? '0 24px 64px rgba(0, 0, 0, 0.72)'
            : '0 20px 54px rgba(0, 0, 0, 0.16)',
          border: isDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
          borderRadius: '20px',
        },
        formButtonPrimary: {
          backgroundColor: '#456dff',
          borderRadius: '999px',
          fontWeight: 600,
          boxShadow: 'none',
        },
        footer: {
          background: isDark ? '#151515' : '#fafafa',
        },
        badge: {
          borderRadius: '999px',
        },
      },
    }),
    [isDark],
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
      signInFallbackRedirectUrl={redirectUrl}
      signUpFallbackRedirectUrl={redirectUrl}
      afterSignOutUrl={redirectUrl}
      allowedRedirectOrigins={ALLOWED_REDIRECT_ORIGINS}
      appearance={clerkAppearance}
    >
      <ClerkAccountBridge>{children}</ClerkAccountBridge>
    </ClerkProvider>
  )
}
