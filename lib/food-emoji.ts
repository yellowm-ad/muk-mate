// 가게명·주문 요약 텍스트에서 음식 종류를 추측해 이모지를 붙여준다.
// 카카오 장소 검색은 사진을 제공하지 않아(키워드 검색 API 한정) 실제 사진 대신 쓰는 대체 수단.
// 매칭되는 게 없으면 null — 호출부가 StoreAvatar의 이니셜 원형으로 폴백한다.
const FOOD_EMOJI_RULES: { keywords: string[]; emoji: string }[] = [
  { keywords: ['치킨', '후라이드', '양념', '파닭', '닭강정', '순살'], emoji: '🍗' },
  { keywords: ['피자'], emoji: '🍕' },
  { keywords: ['떡볶이', '떡볶'], emoji: '🌶️' },
  { keywords: ['족발', '보쌈'], emoji: '🍖' },
  { keywords: ['초밥', '스시', '롤'], emoji: '🍣' },
  { keywords: ['회', '물회'], emoji: '🐟' },
  { keywords: ['마라탕', '마라샹궈', '마라'], emoji: '🌶️' },
  { keywords: ['버거', '햄버거'], emoji: '🍔' },
  { keywords: ['샌드위치', '토스트'], emoji: '🥪' },
  { keywords: ['샐러드'], emoji: '🥗' },
  { keywords: ['커피', '카페', '아메리카노', '라떼'], emoji: '☕' },
  { keywords: ['케이크', '디저트', '빵', '베이커리'], emoji: '🍰' },
  { keywords: ['아이스크림', '빙수'], emoji: '🍦' },
  { keywords: ['짜장', '짬뽕', '탕수육', '중국집', '중식'], emoji: '🥡' },
  { keywords: ['라면'], emoji: '🍜' },
  { keywords: ['우동', '냉면', '쌀국수', '국수'], emoji: '🍜' },
  { keywords: ['김밥'], emoji: '🍙' },
  { keywords: ['도시락'], emoji: '🍱' },
  { keywords: ['삼겹살', '고기', '구이', '갈비'], emoji: '🥩' },
  { keywords: ['곱창', '막창'], emoji: '🍖' },
  { keywords: ['맥주', '술', '안주', '포차'], emoji: '🍺' },
  { keywords: ['분식'], emoji: '🍢' },
  { keywords: ['국밥', '설렁탕', '곰탕', '순대국'], emoji: '🍚' },
  { keywords: ['타코', '멕시칸', '부리또'], emoji: '🌮' },
  { keywords: ['파스타', '스파게티'], emoji: '🍝' },
  { keywords: ['스테이크'], emoji: '🥩' },
  { keywords: ['도넛'], emoji: '🍩' },
  { keywords: ['와플'], emoji: '🧇' },
  { keywords: ['핫도그'], emoji: '🌭' },
  { keywords: ['만두', '교자'], emoji: '🥟' },
  { keywords: ['찌개', '전골'], emoji: '🍲' },
  { keywords: ['과일'], emoji: '🍎' },
]

export function getFoodEmoji(...texts: (string | null | undefined)[]): string | null {
  const combined = texts.filter(Boolean).join(' ')
  for (const rule of FOOD_EMOJI_RULES) {
    if (rule.keywords.some((k) => combined.includes(k))) return rule.emoji
  }
  return null
}
