import { AlertTriangle } from 'lucide-react'
import { estHorsProduction } from '@/lib/base-en-service'

/**
 * Avertit qu'on n'est PAS sur la base de production.
 *
 * L'application se déploie sur plusieurs bases (production, `bot2` pour le
 * développement, une base neuve à venir) et la bascule se fait en recopiant un
 * fichier — `cp .env.test .env`. Rien, à l'écran, ne distinguait ces bases :
 * une copie oubliée et on encode des données de test en production, ou pire,
 * on prend une manipulation destructive pour un essai sans conséquence.
 *
 * Le bandeau ne s'affiche QUE hors production. En ops, le silence est le
 * signal : un avertissement permanent finirait par ne plus être lu, donc par
 * ne plus rien valoir le jour où il compte.
 *
 * Le défaut penche du côté sûr — toute valeur autre que `ops`, y compris une
 * variable absente ou mal orthographiée, est traitée comme une base de test.
 * Un bandeau de trop en développement ne coûte rien ; un bandeau manquant sur
 * une base de test coûte la confusion qu'on cherche justement à éviter.
 *
 * Il défile avec la page plutôt que d'être `sticky`. Le header, lui, colle
 * déjà en haut avec son propre retrait d'encoche : rendre le bandeau collant
 * aussi obligerait à décaler le header et à dédoubler ce retrait, pour gagner
 * un rappel dont on n'a pas besoin en permanence. Le bandeau est là au
 * chargement de chaque page, ce qui suffit à savoir où l'on est.
 */
export function BandeauBase() {
  if (!estHorsProduction) return null

  const base = import.meta.env.VITE_BASE

  // Le libellé nomme la base pour qui en fait tourner plusieurs ; à défaut, la
  // valeur brute de VITE_BASE suffit à dire qu'on n'est pas en production.
  const libelle = import.meta.env.VITE_BASE_LIBELLE || base || 'base inconnue'

  return (
    <div
      role="status"
      className="w-full bg-orange-500 text-white text-center text-xs font-medium px-4 py-1.5 flex items-center justify-center gap-2"
    >
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span>
        BASE DE TEST — {libelle}
        <span className="hidden sm:inline"> · aucune donnée réelle</span>
      </span>
    </div>
  )
}
