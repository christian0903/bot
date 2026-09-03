import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import type { ClassType, CreditType } from '@/types'
import { LoadingState } from '@/components/common/LoadingState'
import { EmptyState } from '@/components/common/EmptyState'
import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,

} from '@/components/ui/select'
import { toast } from 'sonner'
import { Dumbbell, Maximize2, Pencil, Plus, Trash2 } from 'lucide-react'
import { ImageUpload } from '@/components/common/ImageUpload'
import ReactMarkdown from 'react-markdown'
import { MarkdownLink } from '@/components/common/MarkdownLink'

interface ClassTypeForm {
  name: string
  description: string
  description_md: string
  image_url: string
  credit_type_id: string
  default_max_participants: number
  default_duration_minutes: number
  is_active: boolean
}

const emptyForm: ClassTypeForm = {
  name: '',
  description: '',
  description_md: '',
  image_url: '',
  credit_type_id: '',
  default_max_participants: 4,
  default_duration_minutes: 60,
  is_active: true,
}

export function AdminClassTypesPage() {
  const { t, i18n } = useTranslation()
  const isFr = i18n.language === 'fr'
  const [classTypes, setClassTypes] = useState<ClassType[]>([])
  const [creditTypes, setCreditTypes] = useState<CreditType[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editeurPleinEcran, setEditeurPleinEcran] = useState(false)
  const [apercu, setApercu] = useState(false)
  const [globalDefaultMax, setGlobalDefaultMax] = useState(4)
  const [editing, setEditing] = useState<ClassType | null>(null)
  /** Ce qui dépend du type en cours d'édition. Null tant qu'on ne le sait pas. */
  const [usage, setUsage] = useState<{
    total_classes: number; future_classes: number; future_bookings: number; credit_locked: boolean
  } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<ClassType | null>(null)
  const [form, setForm] = useState<ClassTypeForm>(emptyForm)

  const fetchData = async () => {
    const [ctRes, creditRes] = await Promise.all([
      supabase.from('class_types').select('*, credit_type:credit_types(*)').order('name'),
      supabase.from('credit_types').select('*').order('name'),
    ])
    setClassTypes((ctRes.data as ClassType[]) ?? [])
    setCreditTypes((creditRes.data as CreditType[]) ?? [])
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // Fetch global default max participants
    supabase.from('app_settings').select('value').eq('key', 'studio_defaults').single()
      .then(({ data }) => {
        if (data?.value?.default_max_participants) {
          setGlobalDefaultMax(data.value.default_max_participants as number)
        }
      })
  }, [])

  /** Un type qu'on crée n'a rien derrière lui : le champ reste libre. */
  const creditLocked = !!editing && usage?.credit_locked === true

  const openAdd = () => {
    setEditing(null)
    setForm({ ...emptyForm, default_max_participants: globalDefaultMax })
    setDialogOpen(true)
  }

  const openEdit = (ct: ClassType) => {
    setEditing(ct)
    // Le serveur dit ce qui dépend de ce type : l'écran n'a aucune règle à
    // dupliquer, et ne peut donc pas annoncer autre chose que ce que la base
    // appliquera.
    setUsage(null)
    supabase.rpc('class_type_usage', { p_class_type_id: ct.id }).then(({ data }) => {
      setUsage(data as typeof usage)
    })
    setForm({
      name: ct.name,
      description: ct.description ?? '',
      description_md: ct.description_md ?? '',
      image_url: ct.image_url ?? '',
      credit_type_id: ct.credit_type_id,
      default_max_participants: ct.default_max_participants ?? 8,
      default_duration_minutes: ct.default_duration_minutes ?? 60,
      is_active: ct.is_active,
    })
    setDialogOpen(true)
  }

  const handleSave = async () => {
    const payload = {
      name: form.name,
      description: form.description || null,
      description_md: form.description_md || null,
      image_url: form.image_url || null,
      credit_type_id: form.credit_type_id,
      default_max_participants: form.default_max_participants,
      default_duration_minutes: form.default_duration_minutes,
      is_active: form.is_active,
    }
    if (editing) {
      const { error } = await supabase.from('class_types').update(payload).eq('id', editing.id)
      if (error) { toast.error(t('common.error')); return }
    } else {
      const { error } = await supabase.from('class_types').insert(payload)
      if (error) { toast.error(t('common.error')); return }
    }
    toast.success(t('common.saveSuccess'))
    setDialogOpen(false)
    fetchData()
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    const { error } = await supabase.from('class_types').delete().eq('id', deleteTarget.id)
    if (error) { toast.error(t('common.error')); return }
    toast.success(t('common.deleteSuccess'))
    setDeleteTarget(null)
    fetchData()
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.classTypes.title')}</h1>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4 mr-2" />
          {t('admin.classTypes.add')}
        </Button>
      </div>

      {classTypes.length === 0 ? (
        <EmptyState icon={Dumbbell} message={t('common.noResults')} actionLabel={t('admin.classTypes.add')} onAction={openAdd} />
      ) : (
        <div className="border rounded-lg overflow-x-auto">
          <Table className="table-fixed">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[22%]">{t('admin.classTypes.name')}</TableHead>
                <TableHead className="hidden md:table-cell w-[45%]">{t('admin.classTypes.description')}</TableHead>
                <TableHead className="hidden lg:table-cell w-[16%]">{t('admin.classTypes.creditType')}</TableHead>
                <TableHead className="hidden sm:table-cell text-center w-[64px]">Max</TableHead>
                <TableHead className="w-[92px]">{t('admin.classTypes.active')}</TableHead>
                <TableHead className="w-[96px] text-right">{t('common.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {classTypes.map((ct) => (
                <TableRow key={ct.id}>
                  <TableCell className="font-medium truncate">{ct.name}</TableCell>
                  {/* Bornée en largeur et repliée sur deux lignes : sans cela
                      une description longue poussait les boutons d'action hors
                      de l'écran, et personne ne les voyait. */}
                  <TableCell className="hidden md:table-cell max-w-0">
                    <p className="text-sm text-muted-foreground line-clamp-2 whitespace-normal break-words">
                      {ct.description ?? '-'}
                    </p>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">{ct.credit_type?.label_fr ?? '-'}</TableCell>
                  <TableCell className="hidden sm:table-cell text-center font-medium">{ct.default_max_participants ?? '-'}</TableCell>
                  <TableCell>
                    <Badge variant={ct.is_active ? 'default' : 'secondary'}>
                      {ct.is_active ? t('common.active') : t('common.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell className="w-[96px]">
                    <div className="flex gap-1 justify-end">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ct)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(ct)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? t('admin.classTypes.edit') : t('admin.classTypes.add')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('admin.classTypes.name')}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>{t('admin.classTypes.description')}</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label>Description détaillée (markdown)</Label>
                {/* Ces textes font couramment 800 caracteres : cinq lignes au
                    milieu d'un formulaire qui defile ne suffisent pas pour les
                    ecrire ni les relire. */}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditeurPleinEcran(true)}
                >
                  <Maximize2 className="h-4 w-4 mr-1" />
                  {isFr ? 'Agrandir' : 'Expand'}
                </Button>
              </div>
              <Textarea
                value={form.description_md}
                onChange={(e) => setForm(f => ({ ...f, description_md: e.target.value }))}
                rows={5}
                placeholder="Décrivez ce type de cours en détail..."
              />
            </div>
            <div>
              <Label>Photo</Label>
              <ImageUpload
                value={form.image_url || null}
                onChange={(url) => setForm(f => ({ ...f, image_url: url ?? '' }))}
                folder="class-types"
                size="lg"
              />
            </div>
            <div>
              <Label>{t('admin.classTypes.creditType')}</Label>
              <Select
                value={form.credit_type_id}
                disabled={creditLocked}
                onValueChange={(val) => setForm(f => ({ ...f, credit_type_id: val ?? '' }))}
              >
                <SelectTrigger>
                  <span>{creditTypes.find(ct => ct.id === form.credit_type_id)?.label_fr || t('admin.classTypes.creditType')}</span>
                </SelectTrigger>
                <SelectContent>
                  {creditTypes.map(ct => (
                    <SelectItem key={ct.id} value={ct.id}>{ct.label_fr}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Le verrou est posé en base : le dire ici évite un refus
                  incompréhensible au moment d'enregistrer. Changer le type de
                  crédit rendrait incompatibles les packs qui ont déjà payé les
                  réservations de ce cours. */}
              {creditLocked && usage && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">
                  {isFr
                    ? `Verrouillé : ${usage.total_classes} cours planifié${usage.total_classes > 1 ? 's' : ''} en dépendent`
                    : `Locked: ${usage.total_classes} scheduled class${usage.total_classes > 1 ? 'es' : ''} depend on it`}
                  {usage.future_bookings > 0 && (
                    isFr
                      ? `, dont ${usage.future_bookings} réservation${usage.future_bookings > 1 ? 's' : ''} à venir`
                      : `, including ${usage.future_bookings} upcoming booking${usage.future_bookings > 1 ? 's' : ''}`
                  )}
                  {isFr
                    ? '. Créez un nouveau type de cours si la prestation change.'
                    : '. Create a new class type if the service changes.'}
                </p>
              )}
            </div>
            <div>
              <Label>{t('schedule.defaultMaxParticipants')}</Label>
              <Input
                type="number"
                min={1}
                value={form.default_max_participants}
                onChange={(e) => setForm(f => ({ ...f, default_max_participants: parseInt(e.target.value) || 8 }))}
              />
            </div>
            <div>
              <Label>{isFr ? 'Durée par défaut (minutes)' : 'Default duration (minutes)'}</Label>
              <Input
                type="number"
                min={5}
                step={5}
                value={form.default_duration_minutes}
                onChange={(e) => setForm(f => ({ ...f, default_duration_minutes: parseInt(e.target.value) || 60 }))}
              />
              <p className="text-xs text-muted-foreground mt-1">
                {isFr
                  ? 'Proposée à la création d\'un cours de ce type. Reste modifiable cours par cours.'
                  : 'Suggested when scheduling a class of this type. Still editable per class.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(checked) => setForm(f => ({ ...f, is_active: checked }))}
              />
              <Label>{t('admin.classTypes.active')}</Label>
            </div>
          </div>
          {/* Editeur plein ecran, en surimpression du formulaire.
              Il ecrit dans le meme `form.description_md` : rien a valider ni a
              reporter en fermant, et un aller-retour ne peut pas perdre le
              texte. L'enregistrement en base reste le seul bouton du
              formulaire, en dessous. */}
          <Dialog open={editeurPleinEcran} onOpenChange={setEditeurPleinEcran}>
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>
                  {isFr ? 'Description détaillée' : 'Detailed description'}
                  {form.name ? ` — ${form.name}` : ''}
                </DialogTitle>
              </DialogHeader>

              <div className="flex items-center justify-between shrink-0">
                <p className="text-sm text-muted-foreground">
                  {isFr
                    ? 'Markdown accepté : **gras**, *italique*, listes, liens.'
                    : 'Markdown accepted: **bold**, *italic*, lists, links.'}
                </p>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {form.description_md.length} {isFr ? 'caractères' : 'characters'}
                  </span>
                  <Button
                    type="button"
                    variant={apercu ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setApercu(a => !a)}
                  >
                    {isFr ? 'Aperçu' : 'Preview'}
                  </Button>
                </div>
              </div>

              {/* `min-h-0` : sans lui, l'enfant d'un conteneur flex refuse de
                  retrecir sous sa hauteur de contenu et deborde du dialogue —
                  exactement le defaut qu'on corrige ici. */}
              <div className="flex-1 min-h-0">
                {apercu ? (
                  <div className="h-full overflow-y-auto rounded-md border p-4 prose prose-sm dark:prose-invert max-w-none">
                    {form.description_md.trim() ? (
                      <ReactMarkdown components={{ a: MarkdownLink }}>
                        {form.description_md}
                      </ReactMarkdown>
                    ) : (
                      <p className="text-muted-foreground">
                        {isFr ? 'Rien à afficher pour le moment.' : 'Nothing to preview yet.'}
                      </p>
                    )}
                  </div>
                ) : (
                  <Textarea
                    value={form.description_md}
                    onChange={(e) => setForm(f => ({ ...f, description_md: e.target.value }))}
                    className="h-full resize-none font-mono text-sm"
                    placeholder={isFr
                      ? 'Décrivez ce type de cours en détail...'
                      : 'Describe this class type in detail...'}
                    autoFocus
                  />
                )}
              </div>

              <DialogFooter className="shrink-0">
                <Button type="button" onClick={() => setEditeurPleinEcran(false)}>
                  {isFr ? 'Fermer' : 'Close'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={!form.name.trim() || !form.credit_type_id}>
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t('admin.classTypes.delete')}
        description={t('common.confirmDelete')}
        onConfirm={handleDelete}
      />
    </div>
  )
}
