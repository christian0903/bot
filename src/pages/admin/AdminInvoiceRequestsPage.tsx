import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { formatEuros } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { FileText, Check, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { InvoiceRequest } from '@/types'

export function AdminInvoiceRequestsPage() {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'
  const [requests, setRequests] = useState<InvoiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  // L'argent d'abord : « impayée » est la question qui compte, pas « traitée ».
  const [filter, setFilter] = useState<'unpaid' | 'paid' | 'all'>('unpaid')
  /** Saisie en cours par facture : numéro et date, tels qu'Odoo les a attribués. */
  const [drafts, setDrafts] = useState<Record<string, { number: string; date: string }>>({})
  const [savingDetails, setSavingDetails] = useState<string | null>(null)
  const [markingPaid, setMarkingPaid] = useState<string | null>(null)

  const fetchRequests = async () => {
    setLoading(true)
    let query = supabase
      .from('invoice_requests')
      .select('*')
      .order('created_at', { ascending: false })

    if (filter === 'unpaid') {
      query = query.is('paid_at', null).neq('status', 'cancelled')
    } else if (filter === 'paid') {
      query = query.not('paid_at', 'is', null)
    }

    const { data } = await query
    const reqs = (data as InvoiceRequest[]) ?? []

    if (reqs.length > 0) {
      // Fetch profiles
      const userIds = [...new Set(reqs.map(r => r.user_id))]
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, email').in('id', userIds)
      const profileMap = new Map((profiles ?? []).map(p => [p.id, p]))

      // Fetch pack purchases
      const packIds = [...new Set(reqs.map(r => r.pack_purchase_id).filter(Boolean))] as string[]
      let packMap = new Map()
      if (packIds.length > 0) {
        const { data: packs } = await supabase
          .from('pack_purchases')
          .select('id, price_paid_cents, pack_type:pack_types(name)')
          .in('id', packIds)
        packMap = new Map((packs ?? []).map(p => [p.id, p]))
      }

      for (const r of reqs) {
        r.user = profileMap.get(r.user_id) as InvoiceRequest['user']
        if (r.pack_purchase_id) {
          r.pack_purchase = packMap.get(r.pack_purchase_id) as InvoiceRequest['pack_purchase']
        }
      }
    }

    setRequests(reqs)
    setLoading(false)
  }

  useEffect(() => { fetchRequests() }, [filter])

  /**
   * Enregistre le numéro et la date de la facture émise dans Odoo.
   *
   * Séparé de l'encaissement : le numéro est connu dès l'émission, souvent
   * des semaines avant le règlement. Les confondre obligeait à attendre le
   * paiement pour noter une information déjà disponible.
   */
  const handleSaveDetails = async (id: string) => {
    const draft = drafts[id]
    if (!draft?.number?.trim()) {
      toast.error(isFr ? 'Le numéro de facture est requis' : 'Invoice number is required')
      return
    }
    setSavingDetails(id)
    const { data, error } = await supabase.rpc('set_invoice_details', {
      p_invoice_id: id,
      p_invoice_number: draft.number.trim(),
      p_invoice_date: draft.date || null,
    })
    setSavingDetails(null)

    if (error) { toast.error(error.message); return }

    const res = data as { ok: boolean; reason?: string } | null
    if (!res?.ok) {
      const messages: Record<string, string> = {
        duplicate_number: isFr
          ? 'Ce numéro de facture existe déjà.'
          : 'This invoice number already exists.',
        number_required: isFr ? 'Le numéro est requis.' : 'Number is required.',
      }
      toast.error(messages[res?.reason ?? ''] ?? (isFr ? 'Enregistrement impossible' : 'Save failed'))
      return
    }

    toast.success(isFr ? 'Facture enregistrée' : 'Invoice details saved')
    fetchRequests()
  }

  /**
   * Pointe une facture comme encaissée.
   *
   * Sans effet sur les crédits : ils ont été donnés à la commande. Ce geste ne
   * sert qu'au suivi comptable du studio — c'est le contrepoids du paiement à
   * terme, qui laisse le risque d'impayé de son côté.
   */
  const handleMarkPaid = async (id: string) => {
    setMarkingPaid(id)
    const { data, error } = await supabase.rpc('mark_invoice_paid', {
      p_invoice_id: id,
      p_invoice_number: null,
    })
    setMarkingPaid(null)

    if (error) { toast.error(error.message); return }

    // Le refus arrive DANS le retour, sans erreur SQL.
    const res = data as { ok: boolean; reason?: string } | null
    if (!res?.ok) {
      toast.error(isFr ? 'Facture introuvable' : 'Invoice not found')
      return
    }

    toast.success(isFr ? 'Facture pointée comme payée' : 'Invoice marked as paid')
    fetchRequests()
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary" />
          {isFr ? 'Demandes de factures' : 'Invoice Requests'}
        </h1>
        <div className="flex rounded-lg border overflow-hidden">
          {(['unpaid', 'paid', 'all'] as const).map(f => (
            <button
              key={f}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'unpaid' ? (isFr ? 'À encaisser' : 'Unpaid') :
               f === 'paid' ? (isFr ? 'Payées' : 'Paid') :
               (isFr ? 'Toutes' : 'All')}
            </button>
          ))}
        </div>
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={FileText} message={isFr ? 'Aucune demande' : 'No requests'} />
      ) : (
        <div className="space-y-3">
          {requests.map(req => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const purchase = req.pack_purchase as any
            // Le montant vient de la commande sur facture, ou à défaut du pack
            // déjà payé — l'ancien usage de cette table.
            const amount = req.amount_cents ?? purchase?.price_paid_cents ?? null
            const packName = purchase?.pack_type?.name ?? null
            const isPaid = !!req.paid_at

            // Une facture qui traîne : signalée passé un mois, sans automatisme.
            const daysOld = Math.floor(
              (Date.now() - new Date(req.created_at).getTime()) / 86_400_000,
            )
            const isOverdue = !isPaid && daysOld > 30

            return (
              <div
                key={req.id}
                className={cn(
                  'rounded-lg border p-4 space-y-2',
                  isOverdue && 'border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/10',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-semibold">{req.company_name}</span>
                      <Badge
                        variant={isPaid ? 'default' : 'secondary'}
                        className={isPaid ? 'bg-green-600' : ''}
                      >
                        {isPaid ? (
                          <><Check className="h-3 w-3 mr-1" /> {isFr ? 'Payée' : 'Paid'}</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" /> {isFr ? 'À encaisser' : 'Unpaid'}</>
                        )}
                      </Badge>
                      {isOverdue && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                          {isFr ? `${daysOld} jours` : `${daysOld} days`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{req.address}</p>
                    {req.vat_number && (
                      <p className="text-sm text-muted-foreground">{isFr ? 'N° entreprise' : 'VAT'}: {req.vat_number}</p>
                    )}
                  </div>

                  {/* Le montant à droite : c'est ce qu'on cherche en balayant
                      la liste. */}
                  {amount !== null && (
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold">{formatEuros(amount, 2)}</p>
                      {packName && (
                        <p className="text-xs text-muted-foreground">{packName}</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Deux gestes distincts, dans l'ordre du circuit réel :
                    la facture est émise dans Odoo (numéro + date), puis elle
                    est encaissée — parfois des semaines plus tard. Les
                    confondre obligeait à attendre le règlement pour noter un
                    numéro déjà connu. */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-end gap-2 flex-wrap">
                      <div className="flex-1 min-w-[140px] max-w-[200px]">
                        <label className="text-xs text-muted-foreground">
                          {isFr ? 'N° de facture (Odoo)' : 'Invoice number (Odoo)'}
                        </label>
                        <Input
                          className="h-8 text-sm"
                          value={drafts[req.id]?.number ?? req.invoice_number ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDrafts(prev => ({
                            ...prev,
                            [req.id]: { ...(prev[req.id] ?? { number: '', date: '' }), number: e.target.value },
                          }))}
                          placeholder="2026-001"
                        />
                      </div>
                      <div className="w-[150px]">
                        <label className="text-xs text-muted-foreground">
                          {isFr ? 'Date de facture' : 'Invoice date'}
                        </label>
                        <Input
                          type="date"
                          className="h-8 text-sm"
                          value={drafts[req.id]?.date ?? req.invoice_date ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDrafts(prev => ({
                            ...prev,
                            [req.id]: { ...(prev[req.id] ?? { number: '', date: '' }), date: e.target.value },
                          }))}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSaveDetails(req.id)}
                        disabled={savingDetails === req.id}
                      >
                        {savingDetails === req.id
                          ? '...'
                          : (isFr ? 'Enregistrer' : 'Save')}
                      </Button>
                    </div>

                  {!isPaid && (
                    <Button
                      size="sm"
                      onClick={() => handleMarkPaid(req.id)}
                      disabled={markingPaid === req.id}
                    >
                      <Check className="h-4 w-4 mr-1" />
                      {markingPaid === req.id
                        ? '...'
                        : (isFr ? 'Marquer payée' : 'Mark paid')}
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t flex-wrap">
                  <span>{isFr ? 'Membre' : 'Member'}: <span className="font-medium">{req.user?.display_name}</span> ({req.user?.email})</span>
                  <span>{isFr ? 'Commandé le' : 'Ordered'} {format(new Date(req.created_at), 'dd/MM/yyyy', { locale })}</span>
                  {isPaid && req.paid_at && (
                    <span className="text-green-600 dark:text-green-400">
                      {isFr ? 'Encaissée le' : 'Paid'} {format(new Date(req.paid_at), 'dd/MM/yyyy', { locale })}
                      {req.invoice_number ? ` · ${req.invoice_number}` : ''}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
