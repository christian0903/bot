import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { Profile, UserRole } from '@/types'
import { logActivity } from '@/lib/activity-log'

export interface SignUpMetadata {
  display_name: string
  first_name: string
  last_name: string
  phone: string
  date_of_birth: string
  address: string
  cgv_accepted: boolean
  rgpd_accepted: boolean
  referral_code?: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: Profile | null
  roles: UserRole[]
  loading: boolean
  hasRegistrationFee: boolean
  hasUsedTrial: boolean
  signUp: (email: string, password: string, metadata: SignUpMetadata) => Promise<{ error: Error | null }>
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (password: string) => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<void>
  hasRole: (role: UserRole) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [roles, setRoles] = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)
  const [hasRegistrationFee, setHasRegistrationFee] = useState(false)
  const [hasUsedTrial, setHasUsedTrial] = useState(false)

  const fetchProfile = async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
    setProfile(data)
  }

  const fetchRoles = async (userId: string) => {
    const { data } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
    setRoles(data?.map((r) => r.role as UserRole) ?? [])
  }

  const fetchMemberFlags = async (userId: string) => {
    const [feeRes, trialRes] = await Promise.all([
      supabase.from('registration_fees').select('id').eq('user_id', userId).limit(1),
      supabase.from('trial_sessions').select('id').eq('user_id', userId).limit(1),
    ])
    setHasRegistrationFee((feeRes.data?.length ?? 0) > 0)
    setHasUsedTrial((trialRes.data?.length ?? 0) > 0)
  }

  const processReferralCode = async (userId: string, metadata: Record<string, unknown>) => {
    const refCode = metadata?.referral_code as string | undefined
    if (!refCode) return

    // Check if referral already exists for this user
    const { data: existing } = await supabase
      .from('referrals')
      .select('id')
      .eq('referee_id', userId)
      .limit(1)
    if (existing && existing.length > 0) return

    // Find the referrer by code
    const { data: referrer } = await supabase
      .from('profiles')
      .select('id')
      .eq('referral_code', refCode.toUpperCase())
      .single()
    if (!referrer || referrer.id === userId) return

    // Create the referral
    await supabase.from('referrals').insert({
      referrer_id: referrer.id,
      referee_id: userId,
      referral_code: refCode.toUpperCase(),
    })
  }

  const refreshProfile = async () => {
    if (user) {
      await Promise.all([fetchProfile(user.id), fetchRoles(user.id), fetchMemberFlags(user.id)])
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        processReferralCode(s.user.id, s.user.user_metadata)
        Promise.all([fetchProfile(s.user.id), fetchRoles(s.user.id), fetchMemberFlags(s.user.id)]).finally(() =>
          setLoading(false)
        )
      } else {
        setLoading(false)
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      if (s?.user) {
        fetchProfile(s.user.id)
        fetchRoles(s.user.id)
        fetchMemberFlags(s.user.id)
      } else {
        setProfile(null)
        setRoles([])
        setHasRegistrationFee(false)
        setHasUsedTrial(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email: string, password: string, metadata: SignUpMetadata) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          display_name: metadata.display_name,
          first_name: metadata.first_name,
          last_name: metadata.last_name,
          phone: metadata.phone,
          date_of_birth: metadata.date_of_birth,
          address: metadata.address,
          cgv_accepted: metadata.cgv_accepted,
          rgpd_accepted: metadata.rgpd_accepted,
        },
      },
    })
    return { error: error as Error | null }
  }

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (!error && data.user) {
      logActivity({
        action: 'user_login',
        actor_id: data.user.id,
        target_user_id: data.user.id,
        description: `Connexion: ${email}`,
      })
    }
    return { error: error as Error | null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
    setRoles([])
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    })
    return { error: error as Error | null }
  }

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password })
    return { error: error as Error | null }
  }

  const hasRole = (role: UserRole) => {
    if (roles.includes(role)) return true
    // super_admin hérite de toutes les permissions admin
    if (role === 'admin' && roles.includes('super_admin')) return true
    return false
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        loading,
        hasRegistrationFee,
        hasUsedTrial,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        refreshProfile,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
