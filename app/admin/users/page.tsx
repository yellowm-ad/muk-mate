import { getAdminOrNull } from '@/lib/admin/auth'
import { getUsersForAdmin } from '@/lib/admin/data'
import { AdminUsersView } from '@/components/admin/admin-users-view'

export default async function AdminUsersPage() {
  const [users, admin] = await Promise.all([getUsersForAdmin(), getAdminOrNull()])
  return <AdminUsersView users={users} currentAdminId={admin?.id ?? ''} />
}
