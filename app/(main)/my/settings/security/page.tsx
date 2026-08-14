import { EditProfileView } from '@/components/my/edit-profile-view'
import { getCurrentUser, getMyJbnuEmailStatus } from '@/lib/server-data'

export default async function SecuritySettingsPage() {
  const me = await getCurrentUser()
  const jbnuEmail = await getMyJbnuEmailStatus(me.id)
  return <EditProfileView me={{ nickname: me.nickname, zoneCode: me.zoneCode }} jbnuEmail={jbnuEmail} />
}
