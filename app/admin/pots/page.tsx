import { listPots } from '@/lib/server-data'
import { AdminPotsView } from '@/components/admin/admin-pots-view'

export default async function AdminPotsPage() {
  const pots = await listPots()
  return <AdminPotsView pots={pots} />
}
