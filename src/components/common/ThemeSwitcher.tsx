import { useTranslation } from 'react-i18next'
import { useTheme } from '@/contexts/ThemeContext'
import { Sun, Moon, Palette, Sparkles } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ThemeMode } from '@/types'

const themes: { value: ThemeMode; icon: React.ReactNode; labelKey: string }[] = [
  { value: 'classic', icon: <Sun className="h-4 w-4" />, labelKey: 'theme.classic' },
  { value: 'dark', icon: <Moon className="h-4 w-4" />, labelKey: 'theme.dark' },
  { value: 'vivid', icon: <Palette className="h-4 w-4" />, labelKey: 'theme.vivid' },
  { value: 'vivid-dark', icon: <Sparkles className="h-4 w-4" />, labelKey: 'theme.vividDark' },
]

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()
  const { t } = useTranslation()

  const currentTheme = themes.find((th) => th.value === theme)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-9 w-9 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
        {currentTheme?.icon}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {themes.map((th) => (
          <DropdownMenuItem
            key={th.value}
            onClick={() => setTheme(th.value)}
            className={theme === th.value ? 'bg-accent' : ''}
          >
            {th.icon}
            <span className="ml-2">{t(th.labelKey)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
