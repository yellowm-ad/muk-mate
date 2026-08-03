import { MobileFrame } from '@/components/mobile-frame'
import { WelcomeScreen } from '@/components/welcome-screen'
import { getSessionUserOrNull } from '@/lib/server-data'

export default async function RootPage() {
  const me = await getSessionUserOrNull()

  return (
    <MobileFrame>
      <WelcomeScreen href={me ? '/pots' : '/login'} />
    </MobileFrame>
  )
}
