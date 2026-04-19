# Back On Track - Plan d'implémentation technique v2

**Avril 2026 - Document de développement**

> Ce plan est à exécuter une fois la description fonctionnelle validée par les coaches.
> Chaque phase est indépendante et peut être livrée et testée séparément.

---

## Architecture existante

| Couche | Technologie |
|--------|-------------|
| Frontend | React 19 + TypeScript + Tailwind CSS 4 + Vite 8 |
| Backend | Supabase (PostgreSQL + Auth + Realtime + Edge Functions) |
| Paiement | Stripe (à migrer vers Mollie) |
| Mobile | Capacitor 8 (iOS + Android) |
| Notifications | In-app via Supabase Realtime (à enrichir avec push + email) |
| Comptabilité | Odoo (externe, pas d'intégration directe dans l'app) |
| i18n | i18next (FR/EN) |

---

## Phase 1 : Fondations & inscription enrichie

**Durée estimée : 3-4 jours**
**Prérequis : aucun**

### 1.1 Migration base de données

```sql
-- Étendre le profil utilisateur
ALTER TABLE profiles ADD COLUMN date_of_birth DATE;
ALTER TABLE profiles ADD COLUMN address TEXT;
ALTER TABLE profiles ADD COLUMN emergency_contact_name TEXT;
ALTER TABLE profiles ADD COLUMN emergency_contact_phone TEXT;
ALTER TABLE profiles ADD COLUMN objectives TEXT;
ALTER TABLE profiles ADD COLUMN fitness_level TEXT;
ALTER TABLE profiles ADD COLUMN medical_conditions TEXT;
ALTER TABLE profiles ADD COLUMN cgv_accepted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN rgpd_accepted_at TIMESTAMPTZ;
ALTER TABLE profiles ADD COLUMN referral_code TEXT UNIQUE;

-- Ajouter super_admin au type enum
ALTER TYPE user_role ADD VALUE 'super_admin';

-- Ajouter l'étage aux classes
ALTER TABLE scheduled_classes ADD COLUMN floor TEXT CHECK (floor IN ('haut', 'bas'));

-- Ajouter la couleur aux types de cours
ALTER TABLE class_types ADD COLUMN color TEXT DEFAULT '#3B82F6';
```

### 1.2 Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `supabase/migrations/XXXX_extend_profiles.sql` | Nouvelle migration avec les ALTER ci-dessus |
| `src/types/index.ts` | Étendre `Profile`, ajouter `'super_admin'` à `UserRole` |
| `src/pages/auth/AuthPage.tsx` | Formulaire inscription enrichi : champs obligatoires (nom, prénom, email, tel, date naissance, adresse, mdp) + optionnels (contact urgence, objectifs, niveau, conditions médicales) + cases CGV + RGPD + champ code parrainage |
| `src/pages/ProfilePage.tsx` | Édition des nouveaux champs |
| `src/contexts/AuthContext.tsx` | `hasRole` gère `super_admin` (hérite de toutes les permissions admin) |
| `src/i18n/fr.json` + `en.json` | Traductions des nouveaux champs |
| `supabase/schema.sql` | RLS : `super_admin` a toutes les permissions admin |

### 1.3 Génération du code parrainage

À l'inscription, générer automatiquement un code parrainage unique :
- Format : `PRENOM` + 4 chiffres aléatoires (ex: `INGRID4827`)
- Stocké dans `profiles.referral_code`
- Le membre peut le personnaliser plus tard dans son profil
- Trigger PostgreSQL `ON INSERT` sur `profiles`

### 1.4 Validation mot de passe

Configurer Supabase Auth : minimum 12 caractères.
Côté frontend : validation avec feedback visuel (force du mot de passe).

---

## Phase 2 : Migration Stripe vers Mollie

**Durée estimée : 4-5 jours**
**Prérequis : compte Mollie configuré**

### 2.1 Pourquoi Mollie

- Bancontact natif et optimisé pour le marché belge
- Supporte : Bancontact, Visa, Mastercard, Apple Pay, Google Pay, iDEAL, SEPA
- API simple, dashboard en français
- Gère les abonnements récurrents (mandats SEPA)

### 2.2 Configuration

```
# .env (Supabase Edge Functions)
MOLLIE_API_KEY_TEST=test_xxxxx
MOLLIE_API_KEY_LIVE=live_xxxxx
MOLLIE_WEBHOOK_URL=https://xxx.supabase.co/functions/v1/mollie-webhook
```

### 2.3 Nouvelle Edge Function : `create-mollie-payment`

Remplace `create-checkout-session`. Logique :

```typescript
// 1. Vérifier auth
// 2. Charger pack_type + credit_type
// 3. Vérifier éligibilité (member_category)
// 4. Appliquer coupon si fourni
// 5. Déterminer mode (test/live) depuis app_settings
// 6. Créer paiement Mollie :
const payment = await mollie.payments.create({
  amount: { currency: 'EUR', value: '199.00' },
  description: `Pack 10 séances - Back On Track`,
  redirectUrl: `${APP_URL}/my-packs?success=true`,
  webhookUrl: MOLLIE_WEBHOOK_URL,
  method: ['bancontact', 'creditcard', 'applepay'],
  metadata: {
    user_id, pack_type_id, price_paid_cents,
    coupon_id, validity_days, credit_count
  }
});
// 7. Retourner payment.getCheckoutUrl()
```

### 2.4 Nouvelle Edge Function : `mollie-webhook`

Remplace `stripe-webhook`. Logique :

```typescript
// 1. Recevoir notification Mollie (POST avec id du paiement)
// 2. Vérifier le statut du paiement via API Mollie
// 3. Si status === 'paid' :
//    a. Créer pack_purchases record
//    b. Incrémenter coupon usage si applicable
//    c. Créer notification de succès
//    d. Logger l'activité
// 4. Si status === 'failed' ou 'expired' :
//    a. Créer notification d'échec
```

### 2.5 Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/create-mollie-payment/index.ts` | Nouvelle function (copier la logique de create-checkout-session, adapter à l'API Mollie) |
| `supabase/functions/mollie-webhook/index.ts` | Nouvelle function |
| `src/pages/PacksPage.tsx` | Remplacer l'appel à create-checkout-session par create-mollie-payment. Redirection vers URL Mollie au lieu de Stripe |
| `src/pages/admin/AdminSettingsPage.tsx` | Remplacer toggle Stripe par toggle Mollie (test/live) |
| `package.json` | Pas de dépendance côté frontend (Mollie est un redirect, pas un SDK JS) |

### 2.6 Dépendance Deno (Edge Functions)

```typescript
import createMollieClient from 'https://esm.sh/@mollie/api-client@4';
```

### 2.7 Migration des données

- Les `pack_purchases` existantes avec `stripe_payment_intent_id` restent telles quelles
- Ajouter colonne `mollie_payment_id TEXT` à `pack_purchases`
- Les futurs achats utilisent `mollie_payment_id`

### 2.8 Conserver Stripe temporairement

Garder les Edge Functions Stripe en place pendant la transition. Ajouter un setting `payment_provider` dans `app_settings` pour basculer.

---

## Phase 3 : Frais d'inscription & statuts membre

**Durée estimée : 4-5 jours**
**Prérequis : Phase 2 (Mollie fonctionnel)**

### 3.1 Migration base de données

```sql
-- Table des frais d'inscription
CREATE TABLE registration_fees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL DEFAULT 3000, -- 30 EUR
  paid_at TIMESTAMPTZ DEFAULT NOW(),
  mollie_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- un seul enregistrement par membre (le dernier)
);

-- Statut membre (calculé mais cacheable)
ALTER TABLE profiles ADD COLUMN member_status TEXT
  DEFAULT 'visitor'
  CHECK (member_status IN ('visitor', 'potential', 'active', 'inactive', 'former'));

-- Séances d'essai
CREATE TABLE trial_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scheduled_class_id UUID REFERENCES scheduled_classes(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id) -- une seule par personne
);

-- RLS
ALTER TABLE registration_fees ENABLE ROW LEVEL SECURITY;
ALTER TABLE trial_sessions ENABLE ROW LEVEL SECURITY;

-- Policies registration_fees
CREATE POLICY "own_read" ON registration_fees FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "admin_read" ON registration_fees FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "own_insert" ON registration_fees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_all" ON registration_fees FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Policies trial_sessions
CREATE POLICY "own_read" ON trial_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON trial_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_read" ON trial_sessions FOR SELECT USING (has_role(auth.uid(), 'admin'));
```

### 3.2 Fonction de calcul du statut

```sql
CREATE OR REPLACE FUNCTION update_member_status(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_has_registration_fee BOOLEAN;
  v_has_active_pack BOOLEAN;
  v_last_pack_expired_at TIMESTAMPTZ;
  v_weeks_since_expiry INTEGER;
  v_status TEXT;
BEGIN
  -- A-t-il payé ses frais ?
  SELECT EXISTS(SELECT 1 FROM registration_fees WHERE user_id = p_user_id) INTO v_has_registration_fee;

  IF NOT v_has_registration_fee THEN
    v_status := 'potential'; -- inscrit mais pas de frais
  ELSE
    -- A-t-il un pack actif ?
    SELECT EXISTS(
      SELECT 1 FROM pack_purchases
      WHERE user_id = p_user_id AND credits_remaining > 0 AND expires_at > NOW()
    ) INTO v_has_active_pack;

    IF v_has_active_pack THEN
      v_status := 'active';
    ELSE
      -- Quand a expiré son dernier pack ?
      SELECT MAX(expires_at) INTO v_last_pack_expired_at
      FROM pack_purchases WHERE user_id = p_user_id;

      IF v_last_pack_expired_at IS NULL THEN
        v_status := 'active'; -- frais payés, pas encore de pack
      ELSE
        v_weeks_since_expiry := EXTRACT(EPOCH FROM (NOW() - v_last_pack_expired_at)) / 604800;
        IF v_weeks_since_expiry <= 6 THEN
          v_status := 'inactive'; -- moins de 6 semaines
        ELSIF v_weeks_since_expiry <= 13 THEN
          v_status := 'inactive'; -- entre 6 sem et 3 mois
        ELSE
          v_status := 'former'; -- plus de 3 mois
        END IF;
      END IF;
    END IF;
  END IF;

  UPDATE profiles SET member_status = v_status WHERE id = p_user_id;
  RETURN v_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 3.3 Edge Function : `create-registration-payment`

Spécifique aux frais d'inscription (30 EUR, pas de coupon applicable) :

```typescript
// Créer paiement Mollie pour 30 EUR
// metadata: { user_id, type: 'registration_fee' }
// Le webhook détecte type=registration_fee et insère dans registration_fees
```

### 3.4 Cron : mise à jour des statuts

```sql
-- pg_cron job quotidien à 2h du matin
SELECT cron.schedule('update-member-statuses', '0 2 * * *',
  $$SELECT update_member_status(id) FROM profiles WHERE member_status != 'visitor'$$
);
```

### 3.5 Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `supabase/migrations/XXXX_registration_fees.sql` | Nouvelle migration |
| `supabase/functions/create-registration-payment/index.ts` | Nouvelle function |
| `supabase/functions/mollie-webhook/index.ts` | Gérer type=registration_fee |
| `src/pages/PacksPage.tsx` | Afficher bloc "Frais d'inscription" si non payés. Bloquer achat pack si frais non payés |
| `src/pages/DashboardPage.tsx` | Afficher statut membre, alerte si frais non payés |
| `src/pages/SchedulePage.tsx` | Permettre séance d'essai si éligible (pas de frais nécessaires). Bouton "Séance d'essai" si `trial_sessions` est vide pour ce user |
| `src/contexts/AuthContext.tsx` | Charger `member_status` et `has_registration_fee` |
| `src/types/index.ts` | Ajouter `MemberStatus`, `RegistrationFee`, `TrialSession` |

---

## Phase 4 : Planning avancé & règles métier

**Durée estimée : 5-6 jours**
**Prérequis : Phase 1 (étage + couleur ajoutés)**

### 4.1 Refonte du composant planning

Créer 3 vues interchangeables :

```
src/components/schedule/
  ScheduleViewSwitcher.tsx    -- Toggle jour/semaine/liste
  DayView.tsx                 -- Vue jour (défaut) : grille horaire
  WeekView.tsx                -- Vue semaine : 7 colonnes
  ListView.tsx                -- Vue liste chronologique
  ClassCard.tsx               -- Carte d'un créneau (réutilisée dans les 3 vues)
  ScheduleFilters.tsx         -- Filtres par type de cours + coach
  DualFloorView.tsx           -- Affichage côte à côte si 2 cours simultanés
```

### 4.2 ClassCard — logique visuelle

```typescript
// Déterminer le style de la carte :
if (class.is_cancelled) → grisé + barré
else if (bookingsCount >= class.max_participants) → grisé "COMPLET"
else if (userHasBooking) → couleur vive + bordure surbrillance "RÉSERVÉ"
else → couleur du type de cours (class_type.color)

// Couleur de fond = class_type.color avec opacité
// Texte : nom du cours, coach, heure, durée, étage, "2/4 places"
```

### 4.3 Règles de fermeture — settings JSONB

```sql
-- Ajouter dans app_settings
INSERT INTO app_settings (key, value) VALUES ('booking_rules', '{
  "morning_cutoff_hour": 20,
  "morning_cutoff_is_day_before": true,
  "morning_class_before_hour": 12,
  "afternoon_hours_before_no_bookings": 3,
  "afternoon_minutes_before_with_bookings": 30,
  "cancellation_free_hours": 12,
  "cancellation_penalty": "credit_lost",
  "no_show_penalty": "credit_lost",
  "no_show_auto_minutes": 15,
  "pt_cancellation_free_hours": 24
}');
```

### 4.4 Fonction RPC : `can_book_class`

```sql
CREATE OR REPLACE FUNCTION can_book_class(p_class_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_class scheduled_classes%ROWTYPE;
  v_rules JSONB;
  v_now TIMESTAMPTZ := NOW();
  v_bookings_count INTEGER;
  v_class_hour INTEGER;
  v_cutoff TIMESTAMPTZ;
  v_result JSONB := '{"can_book": true}'::JSONB;
BEGIN
  SELECT * INTO v_class FROM scheduled_classes WHERE id = p_class_id;
  SELECT value INTO v_rules FROM app_settings WHERE key = 'booking_rules';

  -- Vérif 1 : cours passé
  IF v_class.starts_at <= v_now THEN
    RETURN '{"can_book": false, "reason": "class_past"}'::JSONB;
  END IF;

  -- Vérif 2 : cours annulé
  IF v_class.is_cancelled THEN
    RETURN '{"can_book": false, "reason": "class_cancelled"}'::JSONB;
  END IF;

  -- Vérif 3 : déjà inscrit
  IF EXISTS(SELECT 1 FROM bookings WHERE scheduled_class_id = p_class_id AND user_id = p_user_id AND status = 'confirmed') THEN
    RETURN '{"can_book": false, "reason": "already_booked"}'::JSONB;
  END IF;

  -- Vérif 4 : complet
  SELECT COUNT(*) INTO v_bookings_count FROM bookings WHERE scheduled_class_id = p_class_id AND status = 'confirmed';
  IF v_bookings_count >= v_class.max_participants THEN
    RETURN '{"can_book": false, "reason": "class_full"}'::JSONB;
  END IF;

  -- Vérif 5 : règles de fermeture
  v_class_hour := EXTRACT(HOUR FROM v_class.starts_at AT TIME ZONE 'Europe/Brussels');

  IF v_class_hour < (v_rules->>'morning_class_before_hour')::INTEGER THEN
    -- Cours du matin : fermé la veille à 20h
    v_cutoff := (v_class.starts_at AT TIME ZONE 'Europe/Brussels')::DATE - INTERVAL '1 day'
                + ((v_rules->>'morning_cutoff_hour')::INTEGER || ' hours')::INTERVAL;
    v_cutoff := v_cutoff AT TIME ZONE 'Europe/Brussels';
  ELSE
    -- Cours après-midi/soir
    IF v_bookings_count = 0 THEN
      v_cutoff := v_class.starts_at - ((v_rules->>'afternoon_hours_before_no_bookings')::INTEGER || ' hours')::INTERVAL;
    ELSE
      v_cutoff := v_class.starts_at - ((v_rules->>'afternoon_minutes_before_with_bookings')::INTEGER || ' minutes')::INTERVAL;
    END IF;
  END IF;

  IF v_now > v_cutoff THEN
    RETURN '{"can_book": false, "reason": "booking_closed"}'::JSONB;
  END IF;

  -- Vérif 6 : membre pas bloqué/suspendu
  IF EXISTS(SELECT 1 FROM profiles WHERE id = p_user_id AND member_status IN ('former')) THEN
    RETURN '{"can_book": false, "reason": "member_not_active"}'::JSONB;
  END IF;

  RETURN '{"can_book": true}'::JSONB;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.5 Annulation avec restitution conditionnelle

```sql
CREATE OR REPLACE FUNCTION cancel_booking_v2(p_booking_id UUID, p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_class scheduled_classes%ROWTYPE;
  v_rules JSONB;
  v_hours_before NUMERIC;
  v_free_hours NUMERIC;
  v_refund BOOLEAN;
BEGIN
  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id AND user_id = p_user_id;
  SELECT * INTO v_class FROM scheduled_classes WHERE id = v_booking.scheduled_class_id;
  SELECT value INTO v_rules FROM app_settings WHERE key = 'booking_rules';

  v_hours_before := EXTRACT(EPOCH FROM (v_class.starts_at - NOW())) / 3600;
  v_free_hours := (v_rules->>'cancellation_free_hours')::NUMERIC;
  v_refund := v_hours_before >= v_free_hours;

  -- Annuler la réservation
  UPDATE bookings SET status = 'cancelled', cancelled_at = NOW() WHERE id = p_booking_id;

  -- Restituer le crédit si dans les temps
  IF v_refund THEN
    UPDATE pack_purchases SET credits_remaining = credits_remaining + 1
    WHERE id = v_booking.pack_purchase_id;
  END IF;

  -- Promouvoir depuis la liste d'attente
  PERFORM promote_from_waitlist(v_booking.scheduled_class_id);

  RETURN jsonb_build_object('refunded', v_refund, 'hours_before', v_hours_before);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 4.6 Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `supabase/migrations/XXXX_booking_rules.sql` | Settings + RPC functions |
| `src/pages/SchedulePage.tsx` | Refonte complète : 3 vues, filtres, codes couleur, règles fermeture |
| `src/components/schedule/*.tsx` | Nouveaux composants (voir 4.1) |
| `src/pages/MyBookingsPage.tsx` | Annulation conditionnelle (afficher si crédit restitué ou non) |
| `src/pages/admin/AdminSettingsPage.tsx` | Section "Règles de réservation" configurable |
| `src/pages/admin/AdminSchedulePage.tsx` | Champ étage + couleur à la création de cours |

---

## Phase 5 : Check-in & présences

**Durée estimée : 3-4 jours**
**Prérequis : Phase 4**

### 5.1 Migration

```sql
ALTER TABLE bookings ADD COLUMN checked_in_at TIMESTAMPTZ;
ALTER TABLE bookings ADD COLUMN is_no_show BOOLEAN DEFAULT FALSE;

-- Ajouter action au type enum
ALTER TYPE activity_action ADD VALUE 'check_in';
ALTER TYPE activity_action ADD VALUE 'no_show';
```

### 5.2 QR Code membre

- Générer un QR code à partir de `user_id` (pas de donnée sensible dans le QR)
- Lib frontend : `qrcode.react` pour l'affichage
- Lib scan : `html5-qrcode` pour le scanner coach

```
npm install qrcode.react html5-qrcode
```

### 5.3 No-show automatique

Edge Function déclenchée par pg_cron, 15 min après le début de chaque cours :

```sql
-- Cron toutes les 5 minutes
SELECT cron.schedule('detect-no-shows', '*/5 * * * *', $$
  UPDATE bookings b
  SET is_no_show = TRUE
  WHERE b.status = 'confirmed'
    AND b.checked_in_at IS NULL
    AND b.is_no_show = FALSE
    AND EXISTS (
      SELECT 1 FROM scheduled_classes sc
      WHERE sc.id = b.scheduled_class_id
        AND sc.starts_at + INTERVAL '15 minutes' < NOW()
        AND sc.starts_at > NOW() - INTERVAL '2 hours' -- ne pas traiter les cours anciens
    );
$$);
```

### 5.4 Fichiers à modifier/créer

| Fichier | Modification |
|---------|-------------|
| `src/pages/coach/CoachClassDetailPage.tsx` | Ajouter section check-in : liste avec checkboxes + bouton scanner QR |
| `src/components/QRScanner.tsx` | Nouveau composant (html5-qrcode) |
| `src/components/MemberQRCode.tsx` | Nouveau composant (qrcode.react) |
| `src/pages/ProfilePage.tsx` | Afficher QR code du membre |
| `src/pages/admin/AdminUsersPage.tsx` | Stats présences dans fiche membre |

---

## Phase 6 : Parrainage

**Durée estimée : 4-5 jours**
**Prérequis : Phase 3 (frais d'inscription)**

### 6.1 Migration

```sql
CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES auth.users(id),
  referee_id UUID NOT NULL REFERENCES auth.users(id),
  referral_code TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'qualified', 'rewarded')),
  referrer_reward_cents INTEGER DEFAULT 3000, -- 30 EUR
  referee_reward_cents INTEGER DEFAULT 3000,  -- 30 EUR
  created_at TIMESTAMPTZ DEFAULT NOW(),
  qualified_at TIMESTAMPTZ,
  rewarded_at TIMESTAMPTZ,
  UNIQUE(referee_id) -- un filleul ne peut avoir qu'un seul parrain
);

-- Récompenses utilisables (comme des coupons internes)
CREATE TABLE referral_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  referral_id UUID NOT NULL REFERENCES referrals(id),
  amount_cents INTEGER NOT NULL,
  is_used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Settings parrainage
INSERT INTO app_settings (key, value) VALUES ('referral_rules', '{
  "referrer_reward_cents": 3000,
  "referee_reward_cents": 3000,
  "min_pack_sessions": 10,
  "max_referrals_per_user": null,
  "reward_validity_days": 180
}');

-- RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
-- Policies : own read, admin all
```

### 6.2 Fonction de vérification automatique

```sql
CREATE OR REPLACE FUNCTION check_referral_qualification(p_referee_id UUID)
RETURNS VOID AS $$
DECLARE
  v_referral referrals%ROWTYPE;
  v_has_fee BOOLEAN;
  v_has_pack BOOLEAN;
  v_rules JSONB;
  v_min_sessions INTEGER;
BEGIN
  SELECT * INTO v_referral FROM referrals WHERE referee_id = p_referee_id AND status = 'pending';
  IF NOT FOUND THEN RETURN; END IF;

  SELECT value INTO v_rules FROM app_settings WHERE key = 'referral_rules';
  v_min_sessions := (v_rules->>'min_pack_sessions')::INTEGER;

  -- Condition 1 : frais payés
  SELECT EXISTS(SELECT 1 FROM registration_fees WHERE user_id = p_referee_id) INTO v_has_fee;

  -- Condition 2 : pack >= N séances acheté
  SELECT EXISTS(
    SELECT 1 FROM pack_purchases pp
    JOIN pack_types pt ON pp.pack_type_id = pt.id
    WHERE pp.user_id = p_referee_id AND pt.credit_count >= v_min_sessions
  ) INTO v_has_pack;

  IF v_has_fee AND v_has_pack THEN
    UPDATE referrals SET status = 'qualified', qualified_at = NOW() WHERE id = v_referral.id;

    -- Créer récompenses
    INSERT INTO referral_rewards (user_id, referral_id, amount_cents, expires_at)
    VALUES
      (v_referral.referrer_id, v_referral.id,
       (v_rules->>'referrer_reward_cents')::INTEGER,
       NOW() + ((v_rules->>'reward_validity_days')::INTEGER || ' days')::INTERVAL),
      (v_referral.referee_id, v_referral.id,
       (v_rules->>'referee_reward_cents')::INTEGER,
       NOW() + ((v_rules->>'reward_validity_days')::INTEGER || ' days')::INTERVAL);

    -- Notifications
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES
      (v_referral.referrer_id, 'Parrainage validé !',
       'Votre filleul a rempli les conditions. 30€ de réduction sur votre prochain achat !',
       'success', '/referral'),
      (v_referral.referee_id, 'Récompense parrainage !',
       'Vous avez 30€ de réduction sur votre prochain achat !',
       'success', '/packs');
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 6.3 Appeler la vérification

Déclencher `check_referral_qualification` automatiquement :
- Après paiement des frais d'inscription (dans le webhook Mollie)
- Après achat d'un pack (dans le webhook Mollie)

### 6.4 Appliquer la récompense à l'achat

Dans `create-mollie-payment`, vérifier si le membre a une `referral_reward` non utilisée :
- Si oui, déduire le montant de la récompense du prix
- Marquer la récompense comme utilisée

### 6.5 Fichiers à créer/modifier

| Fichier | Modification |
|---------|-------------|
| `supabase/migrations/XXXX_referrals.sql` | Tables + functions + RLS |
| `src/pages/ReferralPage.tsx` | Nouveau : code parrainage, boutons partage (copier, WhatsApp, SMS, email), tableau filleuls |
| `src/pages/auth/AuthPage.tsx` | Champ code parrainage → créer entrée dans `referrals` si code valide |
| `src/pages/admin/AdminReferralsPage.tsx` | Vue admin : tous les parrainages, statuts, config des règles |
| `supabase/functions/mollie-webhook/index.ts` | Appeler check_referral_qualification + appliquer reward |
| `src/App.tsx` | Routes `/referral` et `/admin/referrals` |

---

## Phase 7 : Personal Training dédié

**Durée estimée : 3-4 jours**
**Prérequis : Phase 4 (planning avancé)**

### 7.1 Migration

```sql
CREATE TABLE coach_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES auth.users(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=lundi
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  is_pt_available BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, day_of_week, start_time)
);

-- Enrichir profil coach
ALTER TABLE profiles ADD COLUMN specialties TEXT[];
ALTER TABLE profiles ADD COLUMN is_coach_profile_public BOOLEAN DEFAULT FALSE;
```

### 7.2 Fichiers à créer/modifier

| Fichier | Modification |
|---------|-------------|
| `src/pages/PersonalTrainingPage.tsx` | Nouveau : liste des coachs PT, filtrer par spécialité |
| `src/pages/CoachPublicProfilePage.tsx` | Nouveau : photo, bio, spécialités, dispos, bouton réserver |
| `src/pages/coach/CoachAvailabilityPage.tsx` | Nouveau : coach gère ses disponibilités PT |
| `src/pages/admin/AdminCoachesPage.tsx` | Enrichir : fiches coachs, dispos, stats |
| `src/App.tsx` | Routes `/personal-training`, `/coach/:id` |
| `src/pages/SchedulePage.tsx` | Les séances PT réservées apparaissent dans le planning du membre |

---

## Phase 8 : Notifications push & email

**Durée estimée : 5-6 jours**
**Prérequis : Phase 2 (Mollie, pour les notifications de paiement)**

### 8.1 Push notifications (FCM)

```
npm install @capacitor/push-notifications firebase
```

Migration :
```sql
CREATE TABLE push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(token)
);
```

Edge Function `send-push` :
```typescript
// Utiliser FCM HTTP v1 API
// POST https://fcm.googleapis.com/v1/projects/{project}/messages:send
// Avec service account key
```

### 8.2 Emails transactionnels

Utiliser **Resend** (simple, bon free tier) ou **SendGrid**.

```
# .env
RESEND_API_KEY=re_xxxxx
FROM_EMAIL=noreply@backontrackstudio.be
```

Edge Function `send-email` :
```typescript
// Templates HTML stockés dans l'edge function
// Utiliser API Resend : POST https://api.resend.com/emails
```

### 8.3 Templates email

```
supabase/functions/send-email/templates/
  booking-confirmed.html
  booking-cancelled.html
  booking-reminder.html
  payment-success.html
  payment-failed.html
  welcome.html
  referral-qualified.html
  waitlist-spot.html
  card-expiring.html
```

### 8.4 Cron rappels

```sql
-- Rappel 24h avant
SELECT cron.schedule('reminders-24h', '0 * * * *', $$
  -- Trouver les cours qui commencent dans 23-25h
  -- Envoyer push à chaque inscrit
$$);

-- Rappel 2h avant
SELECT cron.schedule('reminders-2h', '*/15 * * * *', $$
  -- Trouver les cours qui commencent dans 1h45-2h15
  -- Envoyer push à chaque inscrit
$$);
```

### 8.5 Notifications préférences

```sql
ALTER TABLE profiles ADD COLUMN notification_preferences JSONB DEFAULT '{
  "booking_confirmed": {"push": true, "email": true},
  "booking_reminder": {"push": true, "email": false},
  "booking_cancelled": {"push": true, "email": true},
  "waitlist_spot": {"push": true, "email": true},
  "card_low": {"push": true, "email": false},
  "card_expired": {"push": true, "email": true},
  "payment_failed": {"push": true, "email": true},
  "referral": {"push": true, "email": true},
  "coach_message": {"push": true, "email": false},
  "new_class": {"push": true, "email": false}
}';
```

### 8.6 Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/contexts/NotificationContext.tsx` | Enregistrer push token au login, écouter push reçu |
| `src/pages/ProfilePage.tsx` | Section préférences de notifications |
| `supabase/functions/send-push/index.ts` | Nouveau |
| `supabase/functions/send-email/index.ts` | Nouveau |
| `supabase/functions/send-reminders/index.ts` | Nouveau (cron) |
| `capacitor.config.ts` | Ajouter config push |
| `android/app/google-services.json` | Config Firebase |
| `ios/App/GoogleService-Info.plist` | Config Firebase |

---

## Phase 9 : Demande de facture

**Durée estimée : 1-2 jours**
**Prérequis : aucun (peut être fait à tout moment)**

### 9.1 Migration

```sql
CREATE TABLE invoice_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  pack_purchase_id UUID REFERENCES pack_purchases(id),
  company_name TEXT NOT NULL,
  address TEXT NOT NULL,
  vat_number TEXT, -- numéro d'entreprise (optionnel)
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processed')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE invoice_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own_read" ON invoice_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own_insert" ON invoice_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "admin_all" ON invoice_requests FOR ALL USING (has_role(auth.uid(), 'admin'));
```

### 9.2 Fichiers à créer/modifier

| Fichier | Modification |
|---------|-------------|
| `src/pages/InvoiceRequestPage.tsx` | Nouveau : formulaire (nom/raison sociale, adresse, n° entreprise, sélection du paiement) |
| `src/pages/admin/AdminInvoiceRequestsPage.tsx` | Nouveau : liste des demandes, filtrer pending/processed, bouton "Marquer comme traitée" |
| `src/pages/ProfilePage.tsx` | Lien vers "Demander une facture" |
| `src/App.tsx` | Routes |
| `src/types/index.ts` | Interface `InvoiceRequest` |

---

## Phase 10 : Stats membre & gamification

**Durée estimée : 3-4 jours**
**Prérequis : Phase 5 (check-in pour données de présence)**

### 10.1 RPC functions pour les stats

```sql
-- Séances par période
CREATE FUNCTION member_sessions_count(p_user_id UUID, p_from DATE, p_to DATE)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM bookings b
  JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
  WHERE b.user_id = p_user_id AND b.status = 'confirmed'
    AND b.checked_in_at IS NOT NULL
    AND sc.starts_at::DATE BETWEEN p_from AND p_to;
$$ LANGUAGE sql SECURITY DEFINER;

-- Répartition par type de cours
CREATE FUNCTION member_sessions_by_type(p_user_id UUID)
RETURNS TABLE(class_type_name TEXT, count BIGINT) AS $$
  SELECT ct.name, COUNT(*) FROM bookings b
  JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
  JOIN class_types ct ON sc.class_type_id = ct.id
  WHERE b.user_id = p_user_id AND b.checked_in_at IS NOT NULL
  GROUP BY ct.name ORDER BY count DESC;
$$ LANGUAGE sql SECURITY DEFINER;

-- Streak (semaines consécutives)
CREATE FUNCTION member_streak(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_streak INTEGER := 0;
  v_week DATE;
  v_current_week DATE := date_trunc('week', NOW())::DATE;
BEGIN
  LOOP
    v_week := v_current_week - (v_streak * 7);
    IF EXISTS(
      SELECT 1 FROM bookings b
      JOIN scheduled_classes sc ON b.scheduled_class_id = sc.id
      WHERE b.user_id = p_user_id AND b.checked_in_at IS NOT NULL
        AND sc.starts_at::DATE BETWEEN v_week AND v_week + 6
    ) THEN
      v_streak := v_streak + 1;
    ELSE
      EXIT;
    END IF;
  END LOOP;
  RETURN v_streak;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 10.2 Objectifs et badges

```sql
ALTER TABLE profiles ADD COLUMN weekly_goal INTEGER DEFAULT 3;

CREATE TABLE member_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  badge_type TEXT NOT NULL, -- '10_sessions', '50_sessions', '100_sessions', '10_streak', etc.
  earned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_type)
);
```

### 10.3 Fichiers à créer

| Fichier | Modification |
|---------|-------------|
| `src/pages/StatsPage.tsx` | Nouveau : séances total, graphiques par type (recharts), streak, calendrier coloré, badges, objectif hebdo |
| `src/components/stats/SessionsChart.tsx` | Graphique camembert par type de cours |
| `src/components/stats/StreakDisplay.tsx` | Affichage du streak avec flamme |
| `src/components/stats/ActivityCalendar.tsx` | Calendrier avec jours colorés |
| `src/components/stats/BadgeGrid.tsx` | Grille de badges (débloqués / verrouillés) |
| `src/components/stats/WeeklyGoal.tsx` | Barre de progression objectif |
| `src/App.tsx` | Route `/stats` |
| `package.json` | Ajouter `recharts` |

---

## Phase 11 : Admin avancé

**Durée estimée : 4-5 jours**
**Prérequis : Phases 5, 6, 7, 8**

### 11.1 Communication segmentée

```typescript
// Segments disponibles :
type Segment =
  | { type: 'all' }
  | { type: 'status', value: MemberStatus }
  | { type: 'class_type', value: string }
  | { type: 'class_id', value: string }
  | { type: 'inactive_days', value: number }
  | { type: 'birthday_today' };

// L'admin choisit un segment, rédige un message, et envoie en push et/ou email
```

### 11.2 Messages automatiques

Dans `app_settings` clé `auto_messages` :
```json
{
  "welcome": { "enabled": true, "delay_hours": 0 },
  "birthday": { "enabled": true },
  "inactivity_reminder": { "enabled": true, "days": 14 },
  "milestone_10": { "enabled": true },
  "milestone_50": { "enabled": true },
  "milestone_100": { "enabled": true }
}
```

Cron quotidien qui vérifie et envoie.

### 11.3 Finances enrichies

- Ajouter comparaison N-1 dans le dashboard admin
- Export CSV format compatible Odoo : date, libellé, montant HT, TVA 21%, montant TTC, référence Mollie
- Vue paiements échoués avec bouton "relancer"

### 11.4 Paramètres complets

Nouvelles clés `app_settings` :
- `studio_info` : nom, adresse, tel, email, logo_url, vat_number
- `opening_hours` : JSON avec jours et horaires
- `cgv_content` : texte HTML des CGV
- `privacy_policy` : texte HTML politique confidentialité

### 11.5 Fichiers à modifier

| Fichier | Modification |
|---------|-------------|
| `src/pages/admin/AdminCommunicationPage.tsx` | Refonte : sélection segment, rédaction message, envoi push/email |
| `src/pages/admin/AdminDashboardPage.tsx` | Ajouter graphiques comparaison N-1, CA par produit |
| `src/pages/admin/AdminSettingsPage.tsx` | Sections : infos salle, horaires, règles réservation, règles parrainage, CGV, politique confidentialité |
| `src/pages/admin/AdminUsersPage.tsx` | Vue "à relancer", filtres avancés |
| `supabase/functions/auto-messages/index.ts` | Nouveau cron |
| `supabase/functions/export-odoo/index.ts` | Nouveau : génère CSV Odoo |

---

## Phase 12 : Abonnements récurrents (différé)

**Durée estimée : 5-6 jours**
**Prérequis : Phase 2 (Mollie), montants confirmés**

### 12.1 Migration

```sql
CREATE TABLE subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sessions_per_week INTEGER NOT NULL,
  price_cents INTEGER NOT NULL,
  renewal_interval_days INTEGER DEFAULT 28, -- 4 semaines
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  plan_id UUID NOT NULL REFERENCES subscription_plans(id),
  mollie_subscription_id TEXT,
  mollie_customer_id TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'suspended')),
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,
  sessions_remaining INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ
);
```

### 12.2 Mollie Subscriptions

```typescript
// 1. Créer un Customer Mollie pour le membre
const customer = await mollie.customers.create({
  name: profile.display_name,
  email: profile.email
});

// 2. Premier paiement (mandate creation)
const payment = await mollie.payments.create({
  amount: { currency: 'EUR', value: '189.00' },
  customerId: customer.id,
  sequenceType: 'first', // crée un mandat
  description: 'Abonnement 3 séances/semaine',
  redirectUrl: `${APP_URL}/subscription?success=true`,
  webhookUrl: MOLLIE_WEBHOOK_URL,
  metadata: { user_id, plan_id, type: 'subscription_first' }
});

// 3. Après le premier paiement confirmé, créer l'abonnement Mollie
const subscription = await mollie.customerSubscriptions.create({
  customerId: customer.id,
  amount: { currency: 'EUR', value: '189.00' },
  interval: '4 weeks',
  description: 'Abonnement Back On Track',
  webhookUrl: MOLLIE_WEBHOOK_URL,
  metadata: { user_id, plan_id }
});
```

### 12.3 Webhook pour abonnements

```typescript
// Gérer les événements :
// - payment.paid (renouvellement réussi) → recharger sessions_remaining
// - payment.failed → statut past_due, notification, relance J+3 J+7
// - subscription.cancelled → statut cancelled
```

---

## Phase 13 : RGPD & sécurité

**Durée estimée : 2-3 jours**
**En continu tout au long du projet**

### 13.1 Export données personnelles

Edge Function `export-user-data` :
- Compile toutes les données du membre : profil, réservations, achats, notifications
- Génère un JSON + PDF
- Le membre peut télécharger depuis son profil

### 13.2 Suppression de compte

Edge Function `delete-user-data` :
- Anonymise le profil (remplacer nom, email par "Utilisateur supprimé")
- Supprimer les données personnelles
- Garder les données agrégées pour les stats (réservations anonymisées)
- Supprimer le compte auth

### 13.3 Rate limiting

Ajouter dans chaque Edge Function :
```typescript
// Simple rate limiting par IP via headers
const ip = req.headers.get('x-forwarded-for');
// Utiliser un compteur Redis ou Supabase pour limiter
```

### 13.4 Fichiers

| Fichier | Modification |
|---------|-------------|
| `supabase/functions/export-user-data/index.ts` | Nouveau |
| `supabase/functions/delete-user-data/index.ts` | Nouveau |
| `src/pages/ProfilePage.tsx` | Boutons "Exporter mes données" + "Supprimer mon compte" |
| `src/pages/PrivacyPolicyPage.tsx` | Nouveau : contenu dynamique depuis app_settings |

---

## Résumé de l'ordonnancement

```
Phase 1  → Fondations (profil, rôles, étages)           3-4 jours
Phase 2  → Migration Mollie                              4-5 jours
Phase 3  → Frais inscription + statuts                   4-5 jours
Phase 4  → Planning avancé + règles                      5-6 jours
Phase 5  → Check-in / présences                          3-4 jours
Phase 6  → Parrainage                                    4-5 jours
Phase 7  → Personal Training                             3-4 jours
Phase 8  → Notifications push + email                    5-6 jours
Phase 9  → Demande de facture                            1-2 jours
Phase 10 → Stats membre                                  3-4 jours
Phase 11 → Admin avancé                                  4-5 jours
Phase 12 → Abonnements (différé)                         5-6 jours
Phase 13 → RGPD & sécurité                               2-3 jours
                                                    ─────────────
                                              Total : ~50-60 jours
```

Chaque phase peut être livrée, testée et mise en production indépendamment.
