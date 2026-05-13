import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { LoadingState } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { toast } from 'sonner'
import { Save } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { MarkdownLink } from '@/components/common/MarkdownLink'

interface AnnouncementValue {
  content: string
  published: boolean
}

export function AdminAnnouncementsPage() {
  const { t, i18n } = useTranslation()
  const { user } = useAuth()
  const [content, setContent] = useState('')
  const [published, setPublished] = useState(false)
  const [loading, setLoading] = useState(true)
  const [settingId, setSettingId] = useState<string | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('*')
        .eq('key', 'announcement')
        .single()

      if (data) {
        const val = data.value as AnnouncementValue
        setContent(val.content ?? '')
        setPublished(val.published ?? false)
        setSettingId(data.id)
      }
      setLoading(false)
    }
    fetchData()
  }, [])

  const handleSave = async () => {
    const value = { content, published }

    if (settingId) {
      const { error } = await supabase
        .from('app_settings')
        .update({ value, updated_by: user?.id ?? null })
        .eq('id', settingId)
      if (error) { toast.error(t('common.error')); return }
    } else {
      const { data, error } = await supabase
        .from('app_settings')
        .insert({ key: 'announcement', value, updated_by: user?.id ?? null })
        .select()
        .single()
      if (error) { toast.error(t('common.error')); return }
      setSettingId(data.id)
    }
    toast.success(t('common.saveSuccess'))
  }

  const handleTogglePublish = async () => {
    const newPublished = !published
    setPublished(newPublished)

    if (settingId) {
      const value = { content, published: newPublished }
      await supabase
        .from('app_settings')
        .update({ value, updated_by: user?.id ?? null })
        .eq('id', settingId)
    }
  }

  if (loading) return <LoadingState />

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('admin.announcements.title')}</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Switch checked={published} onCheckedChange={handleTogglePublish} />
            <Label>{published ? t('admin.announcements.unpublish') : t('admin.announcements.publish')}</Label>
          </div>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            {t('common.save')}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="edit">
        <TabsList>
          <TabsTrigger value="edit">{t('admin.announcements.content')}</TabsTrigger>
          <TabsTrigger value="preview">{t('admin.announcements.preview')}</TabsTrigger>
        </TabsList>

        <TabsContent value="edit">
          <Card>
            <CardContent className="pt-6">
              <Textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={15}
                className="font-mono text-sm"
                placeholder="Markdown..."
              />
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                {i18n.language === 'fr'
                  ? <>Syntaxe utile : <code>**gras**</code>, <code>*italique*</code>, <code>- liste</code>, lien : <code>[texte du lien](https://exemple.be)</code>. Les liens s'ouvrent dans le navigateur système sur iOS/Android.</>
                  : <>Useful syntax: <code>**bold**</code>, <code>*italic*</code>, <code>- list</code>, link: <code>[link text](https://example.com)</code>. Links open in the system browser on iOS/Android.</>}
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.announcements.preview')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MarkdownLink }}>{content}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
