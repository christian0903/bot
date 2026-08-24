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
  resendConfirmation: (email: string) => Promise<{ error: Error | null }>
  updatePassword: (password: string) => Promise<{ error: Error | null }>
  refreshProfile: () => Promise<void>
  hasRole: (role: UserRole) => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Origine à viser dans les liens envoyés par e-mail.
 *
 * Toujours l'URL de production quand elle est connue : le lien doit fonctionner
 * quel que soit l'endroit d'où la demande est partie — une inscription faite
 * depuis un serveur de développement enverrait sinon un lien vers `localhost`,
 * inutilisable depuis le téléphone qui reçoit l'e-mail.
 */
function urlApplication(): string {
  return import.meta.env.VITE_APP_URL ?? window.location.origin
}

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
    // L'essai consommé se lit sur la réservation elle-même : depuis le pack
    // d'essai (2026-08-07), une séance d'essai est une réservation ordinaire.
    // L'ancienne table `trial_sessions` tenait un compte séparé qui finissait
    // par diverger de la réalité — c'est ce qui rendait l'essai invisible.
    const [feeRes, trialRes] = await Promise.all([
      supabase.from('registration_fees').select('id').eq('user_id', userId).limit(1),
      supabase.from('bookings').select('id')
        .eq('user_id', userId).eq('is_trial', true).eq('status', 'confirmed').limit(1),
    ])
    setHasRegistrationFee((feeRes.data?.length ?? 0) > 0)
    setHasUsedTrial((trialRes.data?.length ?? 0) > 0)
  }

  /**
   * Enregistre le parrainage saisi à l'inscription.
   *
   * Passe par `claim_referral_code` plutôt que par un INSERT direct : la
   * policy qui autorisait l'écriture depuis le client laissait n'importe qui
   * s'attribuer un parrain arbitraire. La fonction vérifie tout côté serveur
   * et renvoie la raison d'un échec.
   *
   * Le retour est remonté à l'appelant pour que l'inscription puisse prévenir
   * d'un code inconnu — jusqu'ici l'échec était silencieux et le filleul
   * croyait son parrainage enregistré.
   */
  const processReferralCode = async (
    _userId: string,
    metadata: Record<string, unknown>,
  ): Promise<{ ok: boolean; error?: string }> => {
    const refCode = metadata?.referral_code as string | undefined
    if (!refCode) return { ok: true }

    const { data, error } = await supabase.rpc('claim_referral_code', {
      p_referral_code: refCode,
    })
    if (error) return { ok: false, error: 'rpc_failed' }
    return (data as { ok: boolean; error?: string }) ?? { ok: false }
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
        // Même destination que `resendConfirmation` : les deux e-mails doivent
        // mener au même écran, sinon le second lien renverrait ailleurs que le
        // premier selon l'origine depuis laquelle l'inscription a été faite.
        emailRedirectTo: `${urlApplication()}/auth/confirm`,
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

  /**
   * Renvoie l'e-mail de confirmation d'inscription.
   *
   * Supabase répond **sans erreur** pour une adresse inconnue ou déjà
   * confirmée : c'est délibéré de sa part, et cela nous arrange — répondre
   * différemment selon le cas transformerait ce formulaire en moyen de
   * découvrir qui est inscrit au studio. L'appelant affiche donc toujours le
   * même message.
   *
   * Une erreur remonte malgré tout quand Supabase limite la cadence (une
   * minute entre deux envois) : c'est la seule qui mérite d'être montrée, sans
   * quoi le membre reclique en croyant que rien ne part.
   */
  const resendConfirmation = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${urlApplication()}/auth/confirm` },
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
        resendConfirmation,
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
