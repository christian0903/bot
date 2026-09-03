/**
 * Fabrique un fichier .ics pour qu'un membre ajoute son cours à son agenda.
 *
 * Tout se passe dans le navigateur : aucune requête, rien à déployer. Le
 * fichier est produit puis remis au système, qui l'ouvre dans l'agenda par
 * défaut — Apple Calendar, Google Agenda, Outlook.
 *
 * Ce que ce fichier NE fait PAS : suivre le cours dans le temps. L'entrée est
 * une copie posée dans l'agenda du membre au moment du clic. Si le studio
 * annule ou déplace la séance, l'agenda du membre garde l'ancienne — seule une
 * URL d'abonnement corrigerait cela, et c'est un autre chantier. D'où le `UID`
 * stable ci-dessous : il laisse la porte ouverte, un agenda qui reçoit deux
 * fois le même UID met à jour l'entrée au lieu d'en créer une seconde.
 */

/**
 * Format iCalendar : horodatage UTC, sans séparateurs (RFC 5545).
 * `20260903T140000Z`
 */
function horodatageUTC(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Échappe ce qui a un sens dans iCalendar.
 *
 * La virgule et le point-virgule séparent des valeurs, la barre oblique
 * inverse échappe : sans ce traitement, une description qui contient une
 * virgule tronque le champ, et certains agendas rejettent le fichier entier.
 */
function echapper(texte: string): string {
  return texte
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Replie les lignes à 75 octets, comme l'exige la RFC 5545.
 *
 * Le découpage se fait sur les OCTETS et non sur les caractères : en UTF-8, un
 * « é » en occupe deux, et couper au milieu produit un fichier illisible. Les
 * lignes suivantes commencent par une espace, qui marque la continuation.
 */
function replier(ligne: string): string {
  const octets = new TextEncoder().encode(ligne)
  if (octets.length <= 75) return ligne

  const morceaux: string[] = []
  let courant = new Uint8Array(0)
  const decodeur = new TextDecoder()

  for (const car of ligne) {
    const carOctets = new TextEncoder().encode(car)
    // 74 : l'espace de continuation occupe le 75e octet des lignes suivantes.
    const limite = morceaux.length === 0 ? 75 : 74
    if (courant.length + carOctets.length > limite) {
      morceaux.push(decodeur.decode(courant))
      courant = carOctets
    } else {
      const fusion = new Uint8Array(courant.length + carOctets.length)
      fusion.set(courant)
      fusion.set(carOctets, courant.length)
      courant = fusion
    }
  }
  if (courant.length > 0) morceaux.push(decodeur.decode(courant))

  return morceaux.join('\r\n ')
}

export interface CoursPourAgenda {
  id: string
  starts_at: string
  duration_minutes: number
  intitule: string
  coach?: string | null
  salle?: string | null
  description?: string | null
  lieu?: string | null
}

/**
 * Construit le contenu d'un fichier .ics pour une séance.
 *
 * Les fins de ligne sont des CRLF : la RFC les impose, et Outlook refuse le
 * fichier sans elles.
 */
export function construireICS(cours: CoursPourAgenda, isFr = true): string {
  const debut = new Date(cours.starts_at)
  const fin = new Date(debut.getTime() + cours.duration_minutes * 60_000)

  const details: string[] = []
  if (cours.coach) details.push(isFr ? `Coach : ${cours.coach}` : `Coach: ${cours.coach}`)
  if (cours.salle) details.push(isFr ? `Salle : ${cours.salle}` : `Room: ${cours.salle}`)
  if (cours.description) details.push(cours.description)

  const lignes = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Back On Track Studio//Reservation//FR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    // L'identifiant reprend celui de la séance : réimporter le même cours met à
    // jour l'entrée existante plutôt que d'en ajouter une seconde.
    `UID:${cours.id}@backontrackstudio.be`,
    `DTSTAMP:${horodatageUTC(new Date())}`,
    `DTSTART:${horodatageUTC(debut)}`,
    `DTEND:${horodatageUTC(fin)}`,
    `SUMMARY:${echapper(cours.intitule)}`,
    ...(details.length ? [`DESCRIPTION:${echapper(details.join('\n'))}`] : []),
    ...(cours.lieu ? [`LOCATION:${echapper(cours.lieu)}`] : []),
    'STATUS:CONFIRMED',
    // Un rappel une heure avant : c'est la raison d'être de l'ajout à l'agenda.
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${echapper(cours.intitule)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  return lignes.map(replier).join('\r\n')
}

/**
 * Remet le fichier au système, qui l'ouvre dans l'agenda du membre.
 *
 * Le type MIME `text/calendar` est ce qui déclenche l'ouverture par l'agenda
 * plutôt qu'un téléchargement muet — c'est lui qui fait tout le travail sur
 * iOS et Android.
 */
export function telechargerICS(cours: CoursPourAgenda, isFr = true): void {
  const contenu = construireICS(cours, isFr)
  const blob = new Blob([contenu], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  const lien = document.createElement('a')
  lien.href = url
  // Un nom lisible : c'est ce que le membre voit si son système lui propose
  // d'enregistrer le fichier plutôt que de l'ouvrir.
  const jour = new Date(cours.starts_at).toISOString().slice(0, 10)
  lien.download = `${cours.intitule.replace(/[^\p{L}\p{N}]+/gu, '-').toLowerCase()}-${jour}.ics`
  document.body.appendChild(lien)
  lien.click()
  document.body.removeChild(lien)

  // Libérer l'URL tout de suite annulerait le clic sur certains navigateurs.
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
