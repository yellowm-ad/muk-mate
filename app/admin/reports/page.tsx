import { getReportsForAdmin } from '@/lib/admin/data'
import { ReportsView } from '@/components/admin/reports-view'

export default async function AdminReportsPage() {
  const reports = await getReportsForAdmin()
  return <ReportsView reports={reports} />
}
