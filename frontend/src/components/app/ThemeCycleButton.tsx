import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { themePreferenceLabel, type ThemePreference, useTheme } from '@/context/ThemeContext'

const ORDER: ThemePreference[] = ['light', 'dark', 'system']

export function ThemeCycleButton() {
  const { preference, setPreference, resolved } = useTheme()

  const cycle = () => {
    const i = ORDER.indexOf(preference)
    setPreference(ORDER[(i + 1) % ORDER.length])
  }

  const Icon = preference === 'system' ? Monitor : resolved === 'dark' ? Moon : Sun

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="shrink-0"
      onClick={cycle}
      title={`Aparência: ${themePreferenceLabel(preference)} — clique para alternar`}
    >
      <Icon className="h-5 w-5" />
      <span className="sr-only">Alternar tema ({themePreferenceLabel(preference)})</span>
    </Button>
  )
}
