import { PotsView } from "@/components/pots/pots-view"
import { getCurrentUser, getPots } from "@/lib/api"

export default async function PotsPage() {
  const [pots, me] = await Promise.all([getPots(), getCurrentUser()])
  return <PotsView pots={pots} initialZone={me.zoneCode} />
}
