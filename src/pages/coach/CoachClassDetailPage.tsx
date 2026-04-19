import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabase'
import { logActivity } from '@/lib/activity-log'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { EmptyState } from '@/components/common/EmptyState'
import { LoadingState } from '@/components/common/LoadingState'
import { Users, ArrowLeft, Pencil, Check, X, ScanLine, UserCheck, AlertTriangle, MapPin, UserPlus, UserMinus } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { cn } from '@/lib/utils'
import type { ScheduledClass, Booking } from '@/types'

export function CoachClassDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { t, i18n } = useTranslation()
  const { user, hasRole } = useAuth()
  const navigate = useNavigate()
  const locale = i18n.language === 'fr' ? fr : enUS
  const isFr = i18n.language === 'fr'
  const isAdmin = hasRole('admin')
  const [scheduledClass, setScheduledClass] = useState<ScheduledClass | null>(null)
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const scannerRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const html5QrCodeRef = useRef<any>(null)

  // Edit max participants
  const [editingMax, setEditingMax] = useState(false)
  const [maxValue, setMaxValue] = useState(0)

  // Add member
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [eligibleMembers, setEligibleMembers] = useState<{ user_id: string; display_name: string; credits: number; pack_purchase_id: string }[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [addMemberLoading, setAddMemberLoading] = useState(false)

  const fetchData = async () => {
    if (!id) return

    const [classRes, bookingsRes] = await Promise.all([
      supabase
        .from('scheduled_classes')
        .select('*, class_type:class_types(*, credit_type:credit_types(*))')
        .eq('id', id)
        .single(),
      supabase
        .from('bookings')
        .select('*, user:profiles(id, display_name, email, phone)')
        .eq('scheduled_class_id', id)
        .eq('status', 'confirmed'),
    ])

    const sc = classRes.data as ScheduledClass
    setScheduledClass(sc)
    setMaxValue(sc?.max_participants ?? 0)
    setBookings((bookingsRes.data as Booking[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchData() }, [id])

  const handleSaveMax = async () => {
    if (!id || maxValue < 1) return
    if (maxValue < bookings.length) {
      toast.error(isFr
        ? `Impossible : ${bookings.length} participant(s) déjà inscrit(s)`
        : `Cannot reduce: ${bookings.length} participant(s) already booked`)
      return
    }

    const { error } = await supabase
      .from('scheduled_classes')
      .update({ max_participants: maxValue })
      .eq('id', id)

    if (error) {
      toast.error(error.message)
    } else {
      setScheduledClass(prev => prev ? { ...prev, max_participants: maxValue } : prev)
      setEditingMax(false)
      toast.success(t('common.saveSuccess'))
    }
  }

  // ---- Check-in ----
  const handleCheckIn = async (booking: Booking) => {
    if (booking.checked_in_at) return

    const { error } = await supabase
      .from('bookings')
      .update({ checked_in_at: new Date().toISOString() })
      .eq('id', booking.id)

    if (error) { toast.error(error.message); return }

    await logActivity({
      action: 'check_in',
      actor_id: user?.id ?? null,
      target_user_id: booking.user_id,
      entity_type: 'booking',
      entity_id: booking.id,
      details: { class_name: scheduledClass?.class_type?.name },
      description: `Check-in: ${booking.user?.display_name} — ${scheduledClass?.class_type?.name}`,
    })

    setBookings(prev => prev.map(b =>
      b.id === booking.id ? { ...b, checked_in_at: new Date().toISOString() } : b
    ))
    toast.success(isFr ? `${booking.user?.display_name} pointé(e) !` : `${booking.user?.display_name} checked in!`)
  }

  const handleUndoCheckIn = async (booking: Booking) => {
    const { error } = await supabase
      .from('bookings')
      .update({ checked_in_at: null })
      .eq('id', booking.id)
    if (error) { toast.error(error.message); return }
    setBookings(prev => prev.map(b =>
      b.id === booking.id ? { ...b, checked_in_at: null } : b
    ))
  }

  const handleMarkNoShow = async (booking: Booking) => {
    const { error } = await supabase
      .from('bookings')
      .update({ is_no_show: true })
      .eq('id', booking.id)
    if (error) { toast.error(error.message); return }

    await logActivity({
      action: 'no_show',
      actor_id: user?.id ?? null,
      target_user_id: booking.user_id,
      entity_type: 'booking',
      entity_id: booking.id,
      details: { class_name: scheduledClass?.class_type?.name },
      description: `No-show: ${booking.user?.display_name} — ${scheduledClass?.class_type?.name}`,
    })

    setBookings(prev => prev.map(b =>
      b.id === booking.id ? { ...b, is_no_show: true } : b
    ))
    toast.warning(isFr ? `${booking.user?.display_name} marqué(e) absent(e)` : `${booking.user?.display_name} marked as no-show`)
  }

  // ---- Remove booking ----
  const handleRemoveBooking = async (booking: Booking) => {
    if (!user || !scheduledClass) return

    const { data: result } = await supabase.rpc('cancel_booking_v2', {
      p_booking_id: booking.id,
      p_user_id: booking.user_id,
    })

    if (result?.error) { toast.error(result.error as string); return }

    await logActivity({
      action: 'booking_cancelled',
      actor_id: user.id,
      target_user_id: booking.user_id,
      entity_type: 'booking',
      entity_id: booking.id,
      details: { class_name: scheduledClass.class_type?.name, removed_by_staff: true, refunded: result?.refunded },
      description: `Désinscription: ${booking.user?.display_name} du cours ${scheduledClass.class_type?.name}`,
    })

    await supabase.from('notifications').insert({
      user_id: booking.user_id,
      title: isFr ? 'Réservation annulée' : 'Booking cancelled',
      message: isFr
        ? `Votre réservation pour ${scheduledClass.class_type?.name} du ${format(new Date(scheduledClass.starts_at), 'dd/MM/yyyy HH:mm')} a été annulée.${result?.refunded ? ' Votre crédit a été restitué.' : ''}`
        : `Your booking for ${scheduledClass.class_type?.name} on ${format(new Date(scheduledClass.starts_at), 'dd/MM/yyyy HH:mm')} was cancelled.${result?.refunded ? ' Your credit has been refunded.' : ''}`,
      type: 'warning',
      link: '/my-bookings',
    })

    setBookings(prev => prev.filter(b => b.id !== booking.id))
    toast.success(isFr
      ? `${booking.user?.display_name} désinscrit(e) — crédit ${result?.refunded ? 'restitué' : 'non restitué'}`
      : `${booking.user?.display_name} removed — credit ${result?.refunded ? 'refunded' : 'not refunded'}`)
  }

  // ---- QR Scanner ----
  const startScanner = async () => {
    setScanning(true)
    const { Html5Qrcode } = await import('html5-qrcode')

    setTimeout(() => {
      if (!scannerRef.current) return
      const scanner = new Html5Qrcode('qr-reader')
      html5QrCodeRef.current = scanner

      scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          const booking = bookings.find(b => b.user_id === decodedText || b.user?.id === decodedText)
          if (booking) {
            if (booking.checked_in_at) {
              toast.info(isFr ? 'Déjà pointé(e)' : 'Already checked in')
            } else {
              handleCheckIn(booking)
            }
          } else {
            toast.error(isFr ? 'Membre non inscrit à ce cours' : 'Member not registered for this class')
          }
          stopScanner()
        },
        () => {}
      ).catch(() => {
        toast.error(isFr ? 'Impossible d\'accéder à la caméra' : 'Cannot access camera')
        setScanning(false)
      })
    }, 100)
  }

  const stopScanner = () => {
    if (html5QrCodeRef.current) {
      html5QrCodeRef.current.stop().catch(() => {})
      html5QrCodeRef.current = null
    }
    setScanning(false)
  }

  useEffect(() => { return () => { stopScanner() } }, [])

  const handleMarkAllNoShow = async () => {
    const unchecked = bookings.filter(b => !b.checked_in_at && !b.is_no_show)
    for (const b of unchecked) {
      await handleMarkNoShow(b)
    }
  }

  // ---- Add member ----
  const openAddMember = async () => {
    if (!scheduledClass) return
    setAddMemberLoading(true)
    setAddMemberOpen(true)
    setSelectedMemberId('')

    const creditTypeId = scheduledClass.class_type?.credit_type_id
    if (!creditTypeId) { setAddMemberLoading(false); return }

    const { data: packs } = await supabase
      .from('pack_purchases')
      .select('user_id, credits_remaining, id, pack_type:pack_types(credit_type_id)')
      .gt('credits_remaining', 0)
      .gt('expires_at', new Date().toISOString())

    if (!packs) { setAddMemberLoading(false); return }

    const bookedUserIds = new Set(bookings.map(b => b.user_id))
    const memberMap = new Map<string, { user_id: string; credits: number; pack_purchase_id: string }>()

    for (const p of packs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((p.pack_type as any)?.credit_type_id !== creditTypeId) continue
      if (bookedUserIds.has(p.user_id)) continue
      const existing = memberMap.get(p.user_id)
      if (!existing || p.credits_remaining > existing.credits) {
        memberMap.set(p.user_id, { user_id: p.user_id, credits: p.credits_remaining, pack_purchase_id: p.id })
      }
    }

    const userIds = [...memberMap.keys()]
    if (userIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, display_name').in('id', userIds)
      const result = (profiles ?? []).map(p => ({
        user_id: p.id,
        display_name: p.display_name,
        credits: memberMap.get(p.id)!.credits,
        pack_purchase_id: memberMap.get(p.id)!.pack_purchase_id,
      }))
      result.sort((a, b) => a.display_name.localeCompare(b.display_name))
      setEligibleMembers(result)
    } else {
      setEligibleMembers([])
    }
    setAddMemberLoading(false)
  }

  const handleAddMember = async () => {
    if (!scheduledClass || !selectedMemberId || !user) return
    const member = eligibleMembers.find(m => m.user_id === selectedMemberId)
    if (!member) return
    setAddMemberLoading(true)

    const { error } = await supabase.from('bookings').insert({
      scheduled_class_id: scheduledClass.id,
      user_id: member.user_id,
      pack_purchase_id: member.pack_purchase_id,
    })

    if (error) { toast.error(error.message); setAddMemberLoading(false); return }

    await supabase.rpc('consume_credit', { p_pack_purchase_id: member.pack_purchase_id })

    await logActivity({
      action: 'booking_assigned',
      actor_id: user.id,
      target_user_id: member.user_id,
      entity_type: 'booking',
      details: { class_name: scheduledClass.class_type?.name, starts_at: scheduledClass.starts_at },
      description: `${member.display_name} inscrit au cours ${scheduledClass.class_type?.name} du ${format(new Date(scheduledClass.starts_at), 'dd/MM/yyyy HH:mm')}`,
    })

    await supabase.from('notifications').insert({
      user_id: member.user_id,
      title: isFr ? 'Inscription à un cours' : 'Class booking',
      message: isFr
        ? `Vous avez été inscrit(e) au cours ${scheduledClass.class_type?.name} du ${format(new Date(scheduledClass.starts_at), 'EEEE dd/MM à HH:mm', { locale })}.`
        : `You have been booked for ${scheduledClass.class_type?.name} on ${format(new Date(scheduledClass.starts_at), 'EEEE dd/MM HH:mm', { locale })}.`,
      type: 'success',
      link: '/my-bookings',
    })

    toast.success(isFr ? `${member.display_name} inscrit(e) !` : `${member.display_name} booked!`)
    setAddMemberOpen(false)
    setAddMemberLoading(false)
    fetchData()
  }

  if (loading) return <LoadingState />
  if (!scheduledClass) return <p>{t('common.noResults')}</p>

  const spotsLeft = scheduledClass.max_participants - bookings.length
  const checkedInCount = bookings.filter(b => b.checked_in_at).length
  const noShowCount = bookings.filter(b => b.is_no_show).length
  const startsAt = new Date(scheduledClass.starts_at)
  const isPast = startsAt < new Date()
  const classStarted = isPast || (new Date().getTime() - startsAt.getTime() > 0)
  const isFuture = !isPast

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-1" />
        {t('common.back')}
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{scheduledClass.class_type?.name}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {format(startsAt, 'EEEE dd MMMM yyyy, HH:mm', { locale })}
            {scheduledClass.floor && (
              <span className="ml-2 inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {scheduledClass.floor === 'haut' ? (isFr ? 'Haut' : 'Upper') : (isFr ? 'Bas' : 'Lower')}
              </span>
            )}
          </p>
          {hasRole('super_admin') && (
            <p className="text-[10px] text-muted-foreground/50 font-mono mt-1 select-all">{scheduledClass.id}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Stats bar */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">
                  {bookings.length} / {scheduledClass.max_participants}
                </span>
              </div>
              {checkedInCount > 0 && (
                <Badge variant="default" className="text-[11px] bg-green-600">
                  <UserCheck className="h-3 w-3 mr-1" />
                  {checkedInCount} {isFr ? 'présent(s)' : 'present'}
                </Badge>
              )}
              {noShowCount > 0 && (
                <Badge variant="destructive" className="text-[11px]">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {noShowCount} {isFr ? 'absent(s)' : 'no-show'}
                </Badge>
              )}
            </div>

            {editingMax ? (
              <div className="flex items-center gap-2">
                <Input type="number" min={1} className="w-20 h-8" value={maxValue} onChange={(e) => setMaxValue(parseInt(e.target.value) || 1)} autoFocus />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSaveMax}>
                  <Check className="h-4 w-4 text-primary" />
                </Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditingMax(false); setMaxValue(scheduledClass.max_participants) }}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditingMax(true)}>
                <Pencil className="h-3 w-3 mr-1" />
                {isFr ? 'Places' : 'Spots'}
              </Button>
            )}
          </div>

          {/* QR Scanner + actions */}
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={scanning ? 'destructive' : 'default'}
              size="sm"
              onClick={scanning ? stopScanner : startScanner}
            >
              <ScanLine className="h-4 w-4 mr-1" />
              {scanning ? (isFr ? 'Arrêter le scan' : 'Stop scanning') : (isFr ? 'Scanner QR' : 'Scan QR')}
            </Button>
            {classStarted && bookings.some(b => !b.checked_in_at && !b.is_no_show) && (
              <Button variant="outline" size="sm" onClick={handleMarkAllNoShow}>
                <AlertTriangle className="h-4 w-4 mr-1" />
                {isFr ? 'Marquer absents restants' : 'Mark remaining no-show'}
              </Button>
            )}
          </div>

          {/* QR Reader container */}
          {scanning && (
            <div className="rounded-lg overflow-hidden border">
              <div id="qr-reader" ref={scannerRef} className="w-full" />
            </div>
          )}

          {/* Participants list */}
          {bookings.length === 0 ? (
            <EmptyState icon={Users} message={isFr ? 'Aucun inscrit' : 'No participants'} />
          ) : (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {isFr ? 'Inscrits' : 'Participants'} ({bookings.length})
              </p>
              {bookings.map((booking, index) => {
                const isCheckedIn = !!booking.checked_in_at
                const isNoShow = booking.is_no_show

                return (
                  <div
                    key={booking.id}
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border transition-colors',
                      isCheckedIn && 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800',
                      isNoShow && 'bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-muted-foreground w-6">{index + 1}</span>

                      <button
                        onClick={() => isCheckedIn ? handleUndoCheckIn(booking) : handleCheckIn(booking)}
                        disabled={isNoShow}
                        className={cn(
                          'h-6 w-6 rounded-md border-2 flex items-center justify-center transition-colors shrink-0',
                          isCheckedIn ? 'bg-green-600 border-green-600 text-white'
                            : isNoShow ? 'bg-red-200 border-red-300 cursor-not-allowed'
                            : 'border-gray-300 hover:border-green-500'
                        )}
                      >
                        {isCheckedIn && <Check className="h-4 w-4" />}
                        {isNoShow && <X className="h-4 w-4 text-red-600" />}
                      </button>

                      <div>
                        <p className={cn('font-medium', isNoShow && 'line-through text-muted-foreground')}>
                          {booking.user?.display_name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {booking.user?.phone || booking.user?.email}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isCheckedIn && (
                        <Badge className="text-[10px] bg-green-600">
                          <UserCheck className="h-3 w-3 mr-1" />
                          {format(new Date(booking.checked_in_at!), 'HH:mm')}
                        </Badge>
                      )}
                      {isNoShow && (
                        <Badge variant="destructive" className="text-[10px]">No-show</Badge>
                      )}
                      {!isCheckedIn && !isNoShow && classStarted && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => handleMarkNoShow(booking)}>
                          {isFr ? 'Absent' : 'No-show'}
                        </Button>
                      )}
                      {isFuture && (
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleRemoveBooking(booking)}>
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add member */}
          {isFuture && spotsLeft > 0 && (
            <div className="pt-3 border-t">
              {!addMemberOpen ? (
                <Button variant="outline" className="w-full" onClick={openAddMember}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  {isFr ? 'Ajouter un membre' : 'Add a member'}
                </Button>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {isFr ? 'Ajouter un membre' : 'Add a member'}
                  </p>
                  {addMemberLoading ? (
                    <p className="text-sm text-muted-foreground text-center py-2">...</p>
                  ) : eligibleMembers.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      {isFr ? 'Aucun membre avec des crédits disponibles' : 'No members with available credits'}
                    </p>
                  ) : (
                    <>
                      <Select value={selectedMemberId} onValueChange={setSelectedMemberId}>
                        <SelectTrigger className="h-auto min-h-[2.5rem] whitespace-normal text-left w-full">
                          <span className="text-sm">
                            {selectedMemberId
                              ? (() => {
                                  const m = eligibleMembers.find(m => m.user_id === selectedMemberId)
                                  return m ? `${m.display_name} (${m.credits} crédits)` : ''
                                })()
                              : (isFr ? 'Choisir un membre...' : 'Choose a member...')}
                          </span>
                        </SelectTrigger>
                        <SelectContent className="min-w-[350px] max-h-60" position="popper" sideOffset={4}>
                          {eligibleMembers.map(m => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              {m.display_name} — {m.credits} {isFr ? 'crédit(s)' : 'credit(s)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => setAddMemberOpen(false)}>
                          {t('common.cancel')}
                        </Button>
                        <Button size="sm" className="flex-1" onClick={handleAddMember} disabled={!selectedMemberId || addMemberLoading}>
                          <UserPlus className="h-3.5 w-3.5 mr-1" />
                          {isFr ? 'Inscrire' : 'Book'}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
