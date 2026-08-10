import { notFound, redirect } from 'next/navigation'

import { UserProfileView } from '@/components/users/user-profile-view'
import { getCurrentUser, getUserPublicProfile } from '@/lib/server-data'

/** 다른 사용자 프로필 화면 (§12-2) */
export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const me = await getCurrentUser()

  if (id === me.id) {
    redirect('/my')
  }

  const profile = await getUserPublicProfile(id)
  if (!profile) {
    notFound()
  }

  return <UserProfileView profile={profile} />
}
