import { EditProfileView } from '@/components/my/edit-profile-view'
import { getCurrentUser } from '@/lib/server-data'

export default async function EditProfilePage() {
  const me = await getCurrentUser()
  return <EditProfileView me={{ nickname: me.nickname, zoneCode: me.zoneCode }} />
}
