import { notFound } from "next/navigation"
import { PotDetailView } from "@/components/pots/pot-detail-view"
import { getCurrentUser, getParticipations, getPot } from "@/lib/api"

export default async function PotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [pot, participations, me] = await Promise.all([
    getPot(id),
    getParticipations(id),
    getCurrentUser(),
  ])

  if (!pot) notFound()

  return (
    <PotDetailView pot={pot} participations={participations} isHost={pot.hostId === me.id} />
  )
}
