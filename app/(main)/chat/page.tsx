import { MessageCircle } from 'lucide-react'
import { AppHeader } from '@/components/app-header'
import { TabPlaceholder } from '@/components/tab-placeholder'

export default function ChatPage() {
  return (
    <>
      <AppHeader title="채팅" />
      <TabPlaceholder
        icon={MessageCircle}
        title="채팅"
        description="이 화면은 다음 단계에서 채워집니다."
      />
    </>
  )
}
