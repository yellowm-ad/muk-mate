import { MyPageView } from '@/components/my/my-page-view'
import { getCurrentUser, getMyApplications, getMyHostedPots } from '@/lib/server-data'

export default async function MyPage() {
  const me = await getCurrentUser()
  const [hostedPots, applications] = await Promise.all([
    getMyHostedPots(me.id),
    getMyApplications(me.id),
  ])

  return (
    <MyPageView
      me={{ nickname: me.nickname, zoneCode: me.zoneCode }}
      hostedPots={hostedPots}
      applications={applications}
    />
  )
}
