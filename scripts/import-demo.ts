/**
 * Script de création des données de démonstration
 * Simule une migration depuis un système externe (Technogym, etc.)
 *
 * Usage: npx tsx scripts/import-demo.ts
 *
 * Prérequis:
 * - npm install @supabase/supabase-js tsx
 * - Les types de cours, crédits et packs doivent déjà exister en base
 *   (exécuter la partie 1-3 de seed-all.sql d'abord)
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://aojguoqxbzqcganxgqem.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFvamd1b3F4YnpxY2dhbnhncWVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NTQ3MDE2NCwiZXhwIjoyMDkxMDQ2MTY0fQ.V1GRh_6s7SFbFYzEwb6N_ELNKXHgCoJmdAYnk7t2Y4E'
const DEFAULT_PASSWORD = 'Demo12345678!'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
})

// ============================================
// DONNÉES À IMPORTER
// ============================================

interface UserToCreate {
  email: string
  first_name: string
  last_name: string
  phone: string
  date_of_birth?: string
  address?: string
  roles: ('client' | 'coach' | 'admin')[]
  // Pack info (for clients)
  pack_type_id?: string
  credits_remaining?: number
  purchased_at?: string
  expires_at?: string
  price_paid_cents?: number
  // Registration fee paid?
  registration_fee?: boolean
  // Trial used?
  trial_used?: boolean
}

// Pack type IDs (doivent correspondre à ceux en base)
const PACK_IDS = {
  carte_3: 'aaa10001-0001-0001-0001-000000000001',
  carte_10: 'aaa10001-0001-0001-0001-000000000002',
  carte_20_3m: 'aaa10001-0001-0001-0001-000000000003',
  carte_20_5m: 'aaa10001-0001-0001-0001-000000000004',
  pt_1: 'aaa10001-0001-0001-0001-000000000005',
  pt_5: 'aaa10001-0001-0001-0001-000000000006',
  pt_10: 'aaa10001-0001-0001-0001-000000000007',
  pt_20: 'aaa10001-0001-0001-0001-000000000008',
}

const USERS: UserToCreate[] = [
  // ---- COACHES ----
  {
    email: 'gauthier@backontrackstudio.be',
    first_name: 'Gauthier', last_name: 'Wilhelmi',
    phone: '+32 472 10 01 01',
    roles: ['coach', 'admin'],
  },
  {
    email: 'anselme@backontrackstudio.be',
    first_name: 'Anselme', last_name: 'Meunier',
    phone: '+32 472 10 02 02',
    roles: ['coach', 'admin'],
  },
  {
    email: 'joan@backontrackstudio.be',
    first_name: 'Joan', last_name: 'Rodon',
    phone: '+32 472 10 03 03',
    roles: ['coach', 'admin'],
  },
  {
    email: 'jonasz@backontrackstudio.be',
    first_name: 'Jonasz', last_name: 'Toto',
    phone: '+32 472 10 04 04',
    roles: ['coach'],
  },

  // ---- CLIENTS ----
  {
    email: 'ingrid@demo.bot',
    first_name: 'Ingrid', last_name: 'Van Brussel',
    phone: '+32 472 00 01 01',
    date_of_birth: '1990-03-15',
    address: 'Rue du Midi 10, 1000 Bruxelles',
    roles: ['client'],
    registration_fee: true,
    pack_type_id: PACK_IDS.carte_10,
    credits_remaining: 5,
    purchased_at: '2026-04-05',
    expires_at: '2026-07-04',
    price_paid_cents: 19900,
  },
  {
    email: 'sophie@demo.bot',
    first_name: 'Sophie', last_name: 'Martin',
    phone: '+32 472 00 02 02',
    date_of_birth: '1988-07-22',
    address: 'Avenue Louise 150, 1050 Ixelles',
    roles: ['client'],
    registration_fee: true,
    pack_type_id: PACK_IDS.carte_20_3m,
    credits_remaining: 13,
    purchased_at: '2026-04-10',
    expires_at: '2026-07-09',
    price_paid_cents: 29900,
  },
  {
    email: 'lucas@demo.bot',
    first_name: 'Lucas', last_name: 'Petit',
    phone: '+32 472 00 03 03',
    date_of_birth: '1995-11-08',
    address: 'Chaussée de Wavre 200, 1050 Ixelles',
    roles: ['client'],
    registration_fee: true,
    pack_type_id: PACK_IDS.carte_10,
    credits_remaining: 1,
    purchased_at: '2026-02-01',
    expires_at: '2026-05-01',
    price_paid_cents: 19900,
  },
  {
    email: 'anouck@demo.bot',
    first_name: 'Anouck', last_name: 'Renson',
    phone: '+32 472 00 04 04',
    date_of_birth: '1992-01-30',
    address: 'Rue Haute 50, 1000 Bruxelles',
    roles: ['client'],
    registration_fee: true,
    pack_type_id: PACK_IDS.carte_20_3m,
    credits_remaining: 11,
    purchased_at: '2026-04-01',
    expires_at: '2026-06-30',
    price_paid_cents: 29900,
  },
  {
    email: 'thomas@demo.bot',
    first_name: 'Thomas', last_name: 'Dupont',
    phone: '+32 472 00 05 05',
    date_of_birth: '1998-05-12',
    address: 'Boulevard Anspach 80, 1000 Bruxelles',
    roles: ['client'],
    registration_fee: false,
    trial_used: true,
  },
  {
    email: 'simona@demo.bot',
    first_name: 'Simona', last_name: 'Costamagna',
    phone: '+32 472 00 06 06',
    date_of_birth: '1985-09-25',
    address: 'Rue de Namur 30, 1000 Bruxelles',
    roles: ['client'],
    registration_fee: true,
    pack_type_id: PACK_IDS.pt_10,
    credits_remaining: 10,
    purchased_at: '2026-04-17',
    expires_at: '2026-08-15',
    price_paid_cents: 65000,
  },
  {
    email: 'marie@demo.bot',
    first_name: 'Marie', last_name: 'Lecomte',
    phone: '+32 472 00 07 07',
    date_of_birth: '1993-06-18',
    address: 'Rue de Flandre 25, 1000 Bruxelles',
    roles: ['client'],
    registration_fee: true,
    pack_type_id: PACK_IDS.carte_3,
    credits_remaining: 0,
    purchased_at: '2026-04-08',
    expires_at: '2026-05-06',
    price_paid_cents: 6900,
  },
]

// ============================================
// IMPORT
// ============================================

async function run() {
  console.log('=== Import des utilisateurs demo ===\n')

  const createdUsers: { id: string; email: string; roles: string[] }[] = []

  for (const u of USERS) {
    process.stdout.write(`  ${u.first_name} ${u.last_name} (${u.email})... `)

    // 1. Create user via Admin API
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: u.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: {
        display_name: `${u.first_name} ${u.last_name}`,
        first_name: u.first_name,
        last_name: u.last_name,
        phone: u.phone,
        date_of_birth: u.date_of_birth,
        address: u.address,
        cgv_accepted: true,
        rgpd_accepted: true,
      },
    })

    if (authError) {
      if (authError.message?.includes('already been registered')) {
        // User exists, get their ID
        const { data: existing } = await supabase.from('profiles').select('id').eq('email', u.email).single()
        if (existing) {
          console.log('existe déjà, skip création')
          createdUsers.push({ id: existing.id, email: u.email, roles: u.roles })
        } else {
          console.log('ERREUR:', authError.message)
        }
        continue
      }
      console.log('ERREUR:', authError.message)
      continue
    }

    const userId = authData.user.id
    console.log('OK (', userId.slice(0, 8), ')')
    createdUsers.push({ id: userId, email: u.email, roles: u.roles })

    // 2. Update profile fields not handled by trigger
    await supabase.from('profiles').update({
      phone: u.phone,
      date_of_birth: u.date_of_birth || null,
      address: u.address || null,
    }).eq('id', userId)

    // 3. Set roles
    // Remove default 'client' role for coaches
    if (!u.roles.includes('client')) {
      await supabase.from('user_roles').delete().eq('user_id', userId).eq('role', 'client')
    }
    for (const role of u.roles) {
      if (role === 'client') continue // already created by trigger
      await supabase.from('user_roles').upsert({ user_id: userId, role }, { onConflict: 'user_id,role' })
    }

    // 4. Registration fee
    if (u.registration_fee) {
      await supabase.from('registration_fees').insert({ user_id: userId, amount_cents: 3000 })
    }

    // 5. Pack purchase
    if (u.pack_type_id) {
      await supabase.from('pack_purchases').insert({
        user_id: userId,
        pack_type_id: u.pack_type_id,
        price_paid_cents: u.price_paid_cents ?? 0,
        credits_remaining: u.credits_remaining ?? 0,
        purchased_at: u.purchased_at ?? new Date().toISOString(),
        expires_at: u.expires_at ?? new Date().toISOString(),
      })
    }

    // 6. Trial session
    if (u.trial_used) {
      await supabase.from('trial_sessions').insert({ user_id: userId })
    }

    // 7. Update member status
    await supabase.rpc('update_member_status', { p_user_id: userId })
  }

  // ============================================
  // PARRAINAGES
  // ============================================
  console.log('\n=== Parrainages ===')

  const ingrid = createdUsers.find(u => u.email === 'ingrid@demo.bot')
  const sophie = createdUsers.find(u => u.email === 'sophie@demo.bot')
  const anouck = createdUsers.find(u => u.email === 'anouck@demo.bot')
  const lucas = createdUsers.find(u => u.email === 'lucas@demo.bot')

  if (ingrid && sophie) {
    const { data: refCode } = await supabase.from('profiles').select('referral_code').eq('id', ingrid.id).single()
    if (refCode?.referral_code) {
      await supabase.from('referrals').insert({
        referrer_id: ingrid.id,
        referee_id: sophie.id,
        referral_code: refCode.referral_code,
        status: 'qualified',
        qualified_at: '2026-04-12',
      })
      console.log('  Ingrid → Sophie (qualifié)')
    }
  }

  if (anouck && lucas) {
    const { data: refCode } = await supabase.from('profiles').select('referral_code').eq('id', anouck.id).single()
    if (refCode?.referral_code) {
      await supabase.from('referrals').insert({
        referrer_id: anouck.id,
        referee_id: lucas.id,
        referral_code: refCode.referral_code,
        status: 'pending',
      })
      console.log('  Anouck → Lucas (en attente)')
    }
  }

  // ============================================
  // RÉSUMÉ
  // ============================================
  console.log('\n=== Résumé ===')
  console.log(`  ${createdUsers.length} utilisateurs créés/vérifiés`)
  console.log(`  Mot de passe: ${DEFAULT_PASSWORD}`)
  console.log('\n  Pour créer les cours, exécute la partie 5 de seed-all.sql dans le SQL Editor')
  console.log('  (le bloc DO $$ ... qui génère les cours du 13 avril au 13 mai)')
}

run().catch(console.error)
