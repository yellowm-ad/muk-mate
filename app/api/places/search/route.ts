import { NextResponse } from 'next/server'

import { getSessionUserOrNull } from '@/lib/server-data'

interface KakaoDocument {
  id: string
  place_name: string
  address_name: string
  road_address_name: string
  category_group_name: string
  category_name: string
  x: string // 경도(longitude)
  y: string // 위도(latitude)
}

// 카카오 로컬 API 키워드 장소 검색 서버 프록시.
// 클라이언트는 절대 dapi.kakao.com을 직접 호출하지 않는다 — KAKAO_REST_API_KEY가
// 노출되기 때문. 자세한 내용: .claude/skills/mukmate-kakao-places/SKILL.md
export async function GET(request: Request) {
  const me = await getSessionUserOrNull()
  if (!me) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (!query) {
    return NextResponse.json([])
  }

  if (!process.env.KAKAO_REST_API_KEY) {
    return NextResponse.json({ error: '장소 검색 기능이 아직 설정되지 않았습니다.' }, { status: 503 })
  }

  const kakaoUrl = new URL('https://dapi.kakao.com/v2/local/search/keyword.json')
  kakaoUrl.searchParams.set('query', query)
  kakaoUrl.searchParams.set('size', '10')

  const kakaoRes = await fetch(kakaoUrl, {
    headers: { Authorization: `KakaoAK ${process.env.KAKAO_REST_API_KEY}` },
  })

  if (!kakaoRes.ok) {
    return NextResponse.json({ error: '장소 검색에 실패했습니다.' }, { status: 502 })
  }

  const data = (await kakaoRes.json()) as { documents: KakaoDocument[] }

  const places = data.documents.map((doc) => ({
    id: doc.id,
    name: doc.place_name,
    address: doc.road_address_name || doc.address_name,
    category: doc.category_group_name || doc.category_name.split(' > ').pop() || '',
    lat: Number(doc.y),
    lng: Number(doc.x),
  }))

  return NextResponse.json(places)
}
