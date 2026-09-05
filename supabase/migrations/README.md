# Les migrations, dans l'ordre

> Index tenu à la main, dressé le 2026-09-05 à partir de l'historique git.
> Il ne remplace pas la base : ce qui fait foi, c'est ce qu'on lit dans
> `information_schema`, pas ce fichier ni les noms de fichiers. Le contrôle se
> fait par `check-schema.sql` et `check-policies.sql`.

**Ces fichiers sont un historique, pas une liste de tâches.** Toutes ces
migrations sont appliquées sur `bot-ops` (production) et sur `bot3` (test) au
2026-09-05, vérifié en comparant les deux bases objet par objet.

## Ne jamais renommer ces fichiers

Les préfixes portent **8 chiffres** (`20260805_nom.sql`), là où le CLI Supabase
en attend **14** (`20260805143022_nom.sql`). C'est la cause de la règle 5 du
`CLAUDE.md` — `supabase db push` est proscrit, l'application se fait par
l'éditeur SQL du dashboard.

Renommer pour « réparer » la séquence aggraverait le problème au lieu de le
résoudre : le CLI recalculerait ce qu'il croit appliqué, et un `db push` lancé
ensuite rejouerait des migrations déjà passées — dont
`20260805_reset_member_test_data.sql`, sur une production qui porte de vrais
comptes. La colonne « Version » ci-dessous donne l'ordre réel ; elle suffit à
s'y retrouver sans toucher aux noms.

## Comment lire le tableau

- **Date** — celle du préfixe du fichier ; pour les quatre fichiers qui n'en ont
  pas (⚠️), celle de leur ajout dans git.
- **Version** — celle de `package.json` au commit qui a ajouté le fichier. Elle
  situe la migration dans l'application : `git checkout v3.135.0` remonte le
  code qui allait avec.
- **↩** — la version recule par rapport à la ligne précédente. Plusieurs
  migrations ont été écrites le même jour puis commitées séparément ; l'ordre
  des fichiers n'est donc pas exactement celui des versions. Sans conséquence,
  elles sont toutes appliquées.
- **⚠️** — fichier sans préfixe de date, antérieur à la convention. Daté ici par
  git, laissé tel quel pour la raison ci-dessus.

| # | Date | Version | Migration |
|---|---|---|---|
| 1 | 2026-04-21 | 2.0.0 | `20260421_email_notifications.sql` |
| 2 | 2026-05-11 | 2.8.0 | `20260511_backfill_profile_email.sql` |
| 3 | 2026-05-11 | 2.0.0 ↩ | `20260511_password_reset_action.sql` |
| 4 | 2026-05-11 | 2.7.0 ↩ | `20260511_perf_rls_coach_update.sql` |
| 5 | 2026-05-11 | 2.2.0 ↩ | `20260511_performances.sql` |
| 6 | 2026-05-11 | 2.1.0 ↩ | `20260511_sync_profile_email.sql` |
| 7 | 2026-05-13 | 2.14.0 | `20260513_activity_action_email_change_by_admin.sql` |
| 8 | 2026-05-13 | 2.13.0 ↩ | `20260513_dedupe_coach_profiles.sql` |
| 9 | 2026-08-03 | 2.0.0 ↩ | `add-unlimited-packs.sql` ⚠️ |
| 10 | 2026-08-04 | 2.16.0 | `add-cancel-booking-by-studio.sql` ⚠️ |
| 11 | 2026-08-04 | 2.16.0 | `add-subscriptions.sql` ⚠️ |
| 12 | 2026-08-04 | 2.16.0 | `fix-app-settings-insert-policy.sql` ⚠️ |
| 13 | 2026-08-05 | 2.16.0 | `20260805_activity_action_subscription.sql` |
| 14 | 2026-08-05 | 2.16.0 | `20260805_bons_achat.sql` |
| 15 | 2026-08-05 | 2.16.0 | `20260805_credits_with_source.sql` |
| 16 | 2026-08-05 | 2.16.0 | `20260805_reset_member_test_data.sql` |
| 17 | 2026-08-06 | 2.16.0 | `20260806_annulation_tardive_tracee.sql` |
| 18 | 2026-08-06 | 2.16.0 | `20260806_bon_montant_minimum.sql` |
| 19 | 2026-08-06 | 2.16.0 | `20260806_cancel_by_studio_role_check.sql` |
| 20 | 2026-08-06 | 2.16.0 | `20260806_coach_lecture_packs.sql` |
| 21 | 2026-08-06 | 2.16.0 | `20260806_coach_update_own_classes.sql` |
| 22 | 2026-08-06 | 2.16.0 | `20260806_gestion_roles.sql` |
| 23 | 2026-08-06 | 2.16.0 | `20260806_inscription_par_le_staff.sql` |
| 24 | 2026-08-06 | 2.16.0 | `20260806_renoncer_apres_modification.sql` |
| 25 | 2026-08-07 | 2.41.0 | `20260807_avis_cours.sql` |
| 26 | 2026-08-07 | 2.43.0 | `20260807_clients_b2b.sql` |
| 27 | 2026-08-07 | 2.24.0 ↩ | `20260807_communications_accueil.sql` |
| 28 | 2026-08-07 | 2.50.0 | `20260807_coupons_categories.sql` |
| 29 | 2026-08-07 | 2.25.0 ↩ | `20260807_file_emails.sql` |
| 30 | 2026-08-07 | 2.17.0 ↩ | `20260807_pack_essai.sql` |
| 31 | 2026-08-07 | 2.35.0 ↩ | `20260807_performances_mesurables.sql` |
| 32 | 2026-08-07 | 2.52.0 | `20260807_protection_types_cours.sql` |
| 33 | 2026-08-07 | 2.39.0 ↩ | `20260807_suppression_compte.sql` |
| 34 | 2026-08-07 | 2.55.0 | `20260807153356_avis_delai_reglable.sql` |
| 35 | 2026-08-08 | 2.55.0 | `20260808_avis_admin_filtre_periode.sql` |
| 36 | 2026-08-08 | 2.55.0 | `20260808_avis_consultation.sql` |
| 37 | 2026-08-08 | 2.55.0 | `20260808_avis_fenetre_en_heures.sql` |
| 38 | 2026-08-08 | 2.60.0 | `20260808_quota_frequentation_et_couverture_cycle.sql` |
| 39 | 2026-08-09 | 2.62.0 | `20260809_suivi_clients.sql` |
| 40 | 2026-08-23 | 2.71.0 | `20260823_index_tables_chaudes.sql` |
| 41 | 2026-08-23 | 2.72.0 | `20260823_purge_journal_activite.sql` |
| 42 | 2026-08-23 | 2.65.0 ↩ | `20260823_reservation_atomique.sql` |
| 43 | 2026-08-23 | 2.73.0 | `20260823_revoke_anon.sql` |
| 44 | 2026-08-24 | 2.89.0 | `20260824_categorie_archives.sql` |
| 45 | 2026-08-24 | 2.92.0 | `20260824_categorie_par_pack.sql` |
| 46 | 2026-08-24 | 3.2.0 | `20260824_delete_pack_type_super_admin.sql` |
| 47 | 2026-08-24 | 3.6.0 | `20260824_mode_paiement_pack.sql` |
| 48 | 2026-08-24 | 3.2.0 ↩ | `20260824_pack_promu.sql` |
| 49 | 2026-08-24 | 3.1.0 ↩ | `20260824_periodicite_semaines_mois.sql` |
| 50 | 2026-08-24 | 2.86.0 ↩ | `20260824_signup_attempt_purge.sql` |
| 51 | 2026-08-28 | 3.20.0 | `20260828_alignement_policies_bot.sql` |
| 52 | 2026-08-28 | 3.23.0 | `20260828_chemins_images_relatifs.sql` |
| 53 | 2026-08-28 | 3.21.0 ↩ | `20260828_duree_par_defaut_type_cours.sql` |
| 54 | 2026-08-28 | 3.16.0 ↩ | `20260828_grants_tables.sql` |
| 55 | 2026-08-28 | 3.17.0 ↩ | `20260828_invoice_requests_statuts_b2b.sql` |
| 56 | 2026-08-28 | 3.19.0 ↩ | `20260828_pack_types_lecture_detenteurs.sql` |
| 57 | 2026-08-28 | 3.22.0 ↩ | `20260828_recalcul_statut_membre.sql` |
| 58 | 2026-08-28 | 3.19.0 ↩ | `20260828_retrait_mollie_payment_id.sql` |
| 59 | 2026-08-28 | 3.26.0 | `20260828_stats_parcours.sql` |
| 60 | 2026-08-28 | 3.25.0 ↩ | `20260828_statuts_membre_parcours.sql` |
| 61 | 2026-08-29 | 3.46.0 | `20260829_coach_profiles_sans_donnees_perso.sql` |
| 62 | 2026-08-29 | 3.67.0 | `20260829_fenetre_ouverture_reservations.sql` |
| 63 | 2026-08-29 | 3.53.0 ↩ | `20260829_profiles_lecture_propre_profil.sql` |
| 64 | 2026-08-29 | 3.51.0 ↩ | `20260829_profiles_lecture_restreinte.sql` |
| 65 | 2026-08-29 | 3.66.0 ↩ | `20260829_statut_actif_quatre_semaines.sql` |
| 66 | 2026-08-29 | 3.71.0 | `20260829_trace_mot_de_passe_oublie.sql` |
| 67 | 2026-08-30 | 3.84.0 | `20260830_coupon_une_fois_par_personne.sql` |
| 68 | 2026-08-30 | 3.86.0 | `20260830_effacer_membre_anonymise.sql` |
| 69 | 2026-08-30 | 3.90.0 | `20260830_retirer_pack_essai.sql` |
| 70 | 2026-08-30 | 3.77.0 ↩ | `20260830_seances_anterieures.sql` |
| 71 | 2026-08-31 | 3.89.0 ↩ | `20260831_contact_limite_debit.sql` |
| 72 | 2026-08-31 | 3.93.0 | `20260831_places_prises_par_cours.sql` |
| 73 | 2026-09-03 | 3.128.0 | `20260903_participants_par_cours.sql` |
| 74 | 2026-09-03 | 3.135.0 | `20260903_rappel_presences.sql` |

---

## Après le 2026-09-03

La dernière migration appliquée en production est
`20260903_rappel_presences.sql` (3.135.0), passée sur `bot-ops` le 2026-09-05.
Elle y était absente alors qu'elle partait déjà dans le build 8 de l'App Store —
le bandeau des présences serait resté inerte.

Toute migration suivante s'ajoute ici, **et** se reporte dans `install.sql` dans
le même commit (règle 1). Une policy RLS se reporte **aussi** dans
`check-policies.sql`.
