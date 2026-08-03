import { PotsView } from '@/components/pots/pots-view'
import { getCurrentUser, listPots } from '@/lib/server-data'

export default async function PotsPage() {
  const [pots, me] = await Promise.all([listPots(), getCurrentUser()])
  return <PotsView pots={pots} initialZone={me.zoneCode} />
}
