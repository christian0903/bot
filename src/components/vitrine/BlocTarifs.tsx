import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { one } from '@/lib/supabase-joins'

const URL_APP = import.meta.env.VITE_URL_APPLICATION || 'https://app.backontrackstudio.be'

type PackBrut = {
  id: string
  name: string
  description: string | null
  price_cents: number
  credit_count: number
  validity_days: number
  is_unlimited: boolean
  is_trial: boolean
  credit_types: { name: string } | { name: string }[] | null
}

type Pack = {
  id: string
  nom: string
  description: string | null
  prix: number
  seances: number
  jours: number
  illimite: boolean
  famille: 'semi_prive' | 'personal_training' | 'autre'
}

/**
 * « 91 jours » ne se dit pas, et « 21 semaines » non plus : le studio parle en
 * MOIS, comme l'ancien site. Les durees en base sont pourtant des multiples de
 * 7 — 70, 91, 147 jours — parce qu'elles se comptent en semaines de cours.
 *
 * On arrondit donc au mois le plus proche des qu'on depasse le mois, et on ne
 * garde les semaines que sous ce seuil. 70 jours devient « 2 mois » plutot que
 * « 10 semaines », ce que personne ne lit comme une duree.
 */
function validiteLisible(jours: number): string {
  if (jours >= 28) {
    const mois = Math.round(jours / 30.44)
    return mois <= 1 ? '1 mois' : `${mois} mois`
  }
  if (jours % 7 === 0) {
    const semaines = jours / 7
    return semaines === 1 ? '1 semaine' : `${semaines} semaines`
  }
  return `${jours} jours`
}

function prixLisible(centimes: number): string {
  const euros = centimes / 100
  return Number.isInteger(euros) ? `${euros} €` : `${euros.toFixed(2).replace('.', ',')} €`
}

/**
 * Les tarifs, LUS EN BASE.
 *
 * C'est le point de la reprise qui compte le plus. Sur l'ancien site, les sept
 * prix etaient ecrits en dur dans le page-builder : changer un montant
 * demandait d'ouvrir Bricks, et rien ne garantissait que le site et
 * l'application disent la meme chose. Ils avaient d'ailleurs fini par diverger
 * sur le delai d'annulation — 12 h d'un cote, 24 h de l'autre.
 *
 * Ici, un prix modifie dans l'administration apparait sur la vitrine au
 * rechargement suivant. Il ne peut plus y avoir deux verites.
 *
 * La lecture se fait sans compte : la policy RLS de `pack_types` autorise
 * `SELECT` sur les packs actifs pour tout le monde.
 */
export function BlocTarifs() {
  const [packs, setPacks] = useState<Pack[] | null>(null)
  const [erreur, setErreur] = useState(false)
  // Les frais d'inscription vivent aussi en base, et se desactivent depuis
  // l'administration : les annoncer en dur, c'est risquer de reclamer 30 € que
  // le studio ne demande plus.
  const [frais, setFrais] = useState<number | null>(3000)

  useEffect(() => {
    supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'registration_fee')
      .single()
      .then(({ data, error }) => {
        if (error || !data?.value) return
        const v = data.value as { enabled?: boolean; amount_cents?: number }
        setFrais(v.enabled === false ? null : (v.amount_cents ?? 3000))
      })
  }, [])

  useEffect(() => {
    supabase
      .from('pack_types')
      .select('id,name,description,price_cents,credit_count,validity_days,is_unlimited,is_trial,credit_types(name)')
      .eq('is_active', true)
      .order('price_cents', { ascending: true })
      .then(({ data, error }) => {
        // Tester `error` et pas seulement `data` : un refus de lecture revient
        // dans l'objet de reponse sans lever d'exception, et la section
        // resterait vide sans qu'on sache pourquoi.
        if (error || !data) {
          setErreur(true)
          return
        }
        const familles = (brut: PackBrut): Pack['famille'] => {
          const n = one(brut.credit_types)?.name
          return n === 'semi_prive' || n === 'personal_training' ? n : 'autre'
        }
        setPacks(
          (data as unknown as PackBrut[])
            // La seance d'essai est offerte et se presente ailleurs : la poser
            // entre deux packs payants brouillerait la lecture des prix.
            .filter((p) => !p.is_trial && p.price_cents > 0)
            .map((p) => ({
              id: p.id,
              nom: p.name.trim(),
              description: p.description?.trim() || null,
              prix: p.price_cents,
              seances: p.credit_count,
              jours: p.validity_days,
              illimite: p.is_unlimited,
              famille: familles(p),
            }))
        )
      })
  }, [])

  // Ni squelette ni message d'attente : la section arrive sous la ligne de
  // flottaison, et un bloc qui clignote coute plus qu'il ne rapporte.
  if (erreur || (packs && packs.length === 0)) return null
  if (!packs) return null

  const groupes = [
    { cle: 'semi_prive' as const, titre: 'Cours semi-privés', sous: 'En petit groupe, 5 personnes maximum' },
    { cle: 'personal_training' as const, titre: 'Personal training', sous: 'En tête à tête avec votre coach' },
  ].map((g) => ({ ...g, packs: packs.filter((p) => p.famille === g.cle) }))
    .filter((g) => g.packs.length > 0)

  return (
    <section className="v-section v-section--alt" id="tarifs">
      <div className="v-largeur">
        <h2 className="v-titre-section">Nos tarifs</h2>
        <p className="v-chapeau">
          Pas d'abonnement obligatoire : vous achetez des séances, vous les
          utilisez quand vous voulez pendant leur durée de validité.
        </p>

        {groupes.map((g) => (
          <div key={g.cle} style={{ marginBottom: '3rem' }}>
            <h3 className="v-tarifs__famille">
              {g.titre}
              <span>{g.sous}</span>
            </h3>
            <div className="v-grille">
              {g.packs.map((p) => (
                <article className="v-tarif" key={p.id}>
                  <h4 className="v-tarif__nom">{p.nom}</h4>
                  <p className="v-tarif__prix">{prixLisible(p.prix)}</p>
                  <p className="v-tarif__unite">
                    {p.illimite
                      ? 'Séances illimitées'
                      : `${p.seances} séance${p.seances > 1 ? 's' : ''}`}
                    {!p.illimite && p.seances > 1 && (
                      <> · {prixLisible(Math.round(p.prix / p.seances))} la séance</>
                    )}
                  </p>
                  <ul className="v-tarif__details">
                    {p.description && <li>{p.description}</li>}
                    <li>Validité : {validiteLisible(p.jours)}</li>
                  </ul>
                  <a className="v-bouton v-bouton--ligne" href={`${URL_APP}/auth`}>
                    Choisir ce pack
                  </a>
                </article>
              ))}
            </div>
          </div>
        ))}

        <div className="v-tarifs__notes">
          {frais !== null && (
            <p>
              <strong>Frais d'inscription :</strong> {prixLisible(frais)}, une
              seule fois, à régler dans l'application.
            </p>
          )}
          <p>
            <strong>Modes de paiement :</strong> carte bancaire dans
            l'application, virement bancaire ou facture. Les informations vous
            sont fournies lors de l'inscription.
          </p>
          <p>
            <strong>Remboursement :</strong> les packs ne sont pas remboursables.
            En cas d'empêchement long — blessure, par exemple — contactez-nous :
            on trouvera une solution.
          </p>
          <p>
            Nos tarifs peuvent faire l'objet d'une légère indexation annuelle,
            pour suivre l'évolution des coûts du secteur. Nos membres en sont
            informés au préalable.
          </p>
        </div>
      </div>
    </section>
  )
}
