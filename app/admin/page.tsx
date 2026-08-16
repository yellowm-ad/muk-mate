import { getAdminDashboardData } from '@/lib/admin/data'
import { AdminDashboardView } from '@/components/admin/admin-dashboard-view'

export default async function AdminHomePage() {
  const data = await getAdminDashboardData()
  return <AdminDashboardView data={data} />
}
