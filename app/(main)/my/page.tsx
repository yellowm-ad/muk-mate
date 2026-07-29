import { User } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { TabPlaceholder } from '@/components/tab-placeholder'

export default function MyPage() {
  return (
    <>
      <AppHeader title="마이" />
      <TabPlaceholder
        icon={User}
        title="마이페이지"
        description="이 화면은 다음 단계에서 채워집니다."
      />
    </>
  )
}
