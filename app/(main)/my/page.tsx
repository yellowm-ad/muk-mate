import { MyPageView } from '@/components/my/my-page-view'
import { getCurrentUser, getMannerProfile, getMyApplications, getMyHostedPots } from '@/lib/server-data'

export default async function MyPage() {
  const me = await getCurrentUser()
  const [hostedPots, applications, manner] = await Promise.all([
    getMyHostedPots(me.id),
    getMyApplications(me.id),
    getMannerProfile(me.id),
  ])

  return (
    <MyPageView
      me={{ nickname: me.nickname, zoneCode: me.zoneCode, role: me.role }}
      manner={manner}
      hostedPots={hostedPots}
      applications={applications}
    />
  )
}
