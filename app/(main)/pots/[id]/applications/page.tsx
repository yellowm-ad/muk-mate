import { notFound, redirect } from "next/navigation"
import { PotApplicationsView } from "@/components/pots/pot-applications-view"
import { getCurrentUser, getParticipationsForPot, getPotById } from "@/lib/server-data"

export default async function PotApplicationsPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const me = await getCurrentUser()
  const pot = await getPotById(id)

  if (!pot) notFound()
  if (pot.hostId !== me.id) redirect(`/pots/${id}`)

  const participations = await getParticipationsForPot(id, me.id)

  return <PotApplicationsView pot={pot} participations={participations} />
}
