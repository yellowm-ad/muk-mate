import Image from 'next/image'
import Link from 'next/link'

/** 첫 화면 — 로그인 여부와 무관하게 항상 보여준다. 탭하면 로그인 상태에 따라 /pots 또는 /login으로 이동. */
export function WelcomeScreen({ href }: { href: string }) {
  return (
    <Link href={href} className="relative block flex-1 overflow-hidden">
      <Image
        src="/welcome-splash.webp"
        alt="북대에서 같이 먹자! 먹메이트"
        fill
        priority
        sizes="430px"
        className="object-cover"
      />
      <span className="absolute inset-x-0 bottom-10 text-center text-xs font-medium text-muted-foreground/80">
        화면을 눌러 시작하기
      </span>
    </Link>
  )
}
