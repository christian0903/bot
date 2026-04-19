import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { FileText, Check, Clock } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { InvoiceRequest } from '@/types'

export function AdminInvoiceRequestsPage() {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'
  const [requests, setRequests] = useState<InvoiceRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'pending' | 'processed'>('pending')

  const fetchRequests = async () => {
    setLoading(true)
    let query = supabase
      .from('invoice_requests')
      .select('*, user:profiles(display_name, email), pack_purchase:pack_purchases(price_paid_cents, pack_type:pack_types(name))')
      .order('created_at', { ascending: false })

    if (filter !== 'all') {
      query = query.eq('status', filter)
    }

    const { data } = await query
    setRequests((data as InvoiceRequest[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchRequests() }, [filter])

  const handleMarkProcessed = async (id: string) => {
    const { error } = await supabase
      .from('invoice_requests')
      .update({ status: 'processed', processed_at: new Date().toISOString() })
      .eq('id', id)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(isFr ? 'Demande marquée comme traitée' : 'Request marked as processed')
      fetchRequests()
    }
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
          {(['pending', 'processed', 'all'] as const).map(f => (
            <button
              key={f}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => setFilter(f)}
            >
              {f === 'pending' ? (isFr ? 'En attente' : 'Pending') :
               f === 'processed' ? (isFr ? 'Traitées' : 'Processed') :
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
            const purchaseLabel = purchase
              ? `${purchase.pack_type?.name} — ${(purchase.price_paid_cents / 100).toFixed(0)} €`
              : null

            return (
              <div key={req.id} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold">{req.company_name}</span>
                      <Badge
                        variant={req.status === 'processed' ? 'default' : 'secondary'}
                        className={req.status === 'processed' ? 'bg-green-600' : ''}
                      >
                        {req.status === 'processed' ? (
                          <><Check className="h-3 w-3 mr-1" /> {isFr ? 'Traitée' : 'Processed'}</>
                        ) : (
                          <><Clock className="h-3 w-3 mr-1" /> {isFr ? 'En attente' : 'Pending'}</>
                        )}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{req.address}</p>
                    {req.vat_number && (
                      <p className="text-sm text-muted-foreground">{isFr ? 'N° entreprise' : 'VAT'}: {req.vat_number}</p>
                    )}
                  </div>
                  {req.status === 'pending' && (
                    <Button size="sm" onClick={() => handleMarkProcessed(req.id)}>
                      <Check className="h-4 w-4 mr-1" />
                      {isFr ? 'Marquer traitée' : 'Mark processed'}
                    </Button>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 border-t">
                  <span>{isFr ? 'Membre' : 'Member'}: <span className="font-medium">{req.user?.display_name}</span> ({req.user?.email})</span>
                  {purchaseLabel && <span>{isFr ? 'Paiement' : 'Payment'}: {purchaseLabel}</span>}
                  <span>{format(new Date(req.created_at), 'dd/MM/yyyy HH:mm', { locale })}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
