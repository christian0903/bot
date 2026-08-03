import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { formatEuros } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { FileText, Check } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import type { PackPurchase, InvoiceRequest } from '@/types'

export function InvoiceRequestPage() {
  const { i18n } = useTranslation()
  const { user } = useAuth()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [purchases, setPurchases] = useState<PackPurchase[]>([])
  const [requests, setRequests] = useState<InvoiceRequest[]>([])

  const [companyName, setCompanyName] = useState('')
  const [address, setAddress] = useState('')
  const [vatNumber, setVatNumber] = useState('')
  const [selectedPurchase, setSelectedPurchase] = useState('')

  useEffect(() => {
    if (!user) return

    Promise.all([
      supabase
        .from('pack_purchases')
        .select('*, pack_type:pack_types(name)')
        .eq('user_id', user.id)
        .order('purchased_at', { ascending: false }),
      supabase
        .from('invoice_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false }),
    ]).then(([purchasesRes, requestsRes]) => {
      setPurchases((purchasesRes.data as PackPurchase[]) ?? [])
      setRequests((requestsRes.data as InvoiceRequest[]) ?? [])
      setLoading(false)
    })
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !companyName || !address) return

    setSaving(true)
    const { error } = await supabase.from('invoice_requests').insert({
      user_id: user.id,
      pack_purchase_id: selectedPurchase || null,
      company_name: companyName,
      address,
      vat_number: vatNumber || null,
    })
    setSaving(false)

    if (error) {
      toast.error(error.message)
    } else {
      toast.success(isFr ? 'Demande de facture envoyée !' : 'Invoice request sent!')
      setCompanyName('')
      setAddress('')
      setVatNumber('')
      setSelectedPurchase('')
      // Refresh requests
      const { data } = await supabase
        .from('invoice_requests')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      setRequests((data as InvoiceRequest[]) ?? [])
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Form */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {isFr ? 'Demander une facture' : 'Request an invoice'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{isFr ? 'Nom / Raison sociale' : 'Name / Company'} *</Label>
              <Input
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder={isFr ? 'Ex: Sophie Martin ou SRL Aikicom' : 'E.g. Sophie Martin or Aikicom SRL'}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{isFr ? 'Adresse complète' : 'Full address'} *</Label>
              <Input
                value={address}
                onChange={e => setAddress(e.target.value)}
                placeholder={isFr ? 'Rue, numéro, code postal, ville' : 'Street, number, postal code, city'}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>{isFr ? "Numéro d'entreprise (optionnel)" : 'VAT number (optional)'}</Label>
              <Input
                value={vatNumber}
                onChange={e => setVatNumber(e.target.value)}
                placeholder="BE0xxx.xxx.xxx"
              />
            </div>
            <div className="space-y-2">
              <Label>{isFr ? 'Paiement concerné' : 'Related payment'}</Label>
              <Select value={selectedPurchase} onValueChange={(v) => setSelectedPurchase(v ?? '')}>
                <SelectTrigger>
                  <span className="text-sm">
                    {selectedPurchase
                      ? (() => {
                          const p = purchases.find(p => p.id === selectedPurchase)
                          return p ? `${p.pack_type?.name} — ${formatEuros(p.price_paid_cents, 0)} — ${format(new Date(p.purchased_at), 'dd/MM/yyyy')}` : ''
                        })()
                      : (isFr ? 'Sélectionner un paiement' : 'Select a payment')}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {purchases.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.pack_type?.name} — {formatEuros(p.price_paid_cents, 0)} — {format(new Date(p.purchased_at), 'dd/MM/yyyy')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? '...' : (isFr ? 'Envoyer la demande' : 'Submit request')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Previous requests */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {isFr ? 'Mes demandes' : 'My requests'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length === 0 ? (
            <EmptyState icon={FileText} message={isFr ? 'Aucune demande de facture' : 'No invoice requests'} />
          ) : (
            <div className="space-y-3">
              {requests.map(req => (
                <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="font-medium text-sm">{req.company_name}</p>
                    <p className="text-xs text-muted-foreground">{req.address}</p>
                    {req.vat_number && <p className="text-xs text-muted-foreground">{req.vat_number}</p>}
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(req.created_at), 'dd/MM/yyyy HH:mm', { locale })}
                    </p>
                  </div>
                  <Badge
                    variant={req.status === 'processed' ? 'default' : 'secondary'}
                    className={req.status === 'processed' ? 'bg-green-600' : ''}
                  >
                    {req.status === 'processed' ? (
                      <><Check className="h-3 w-3 mr-1" /> {isFr ? 'Traitée' : 'Processed'}</>
                    ) : (
                      isFr ? 'En attente' : 'Pending'
                    )}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
