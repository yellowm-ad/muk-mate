// 카카오맵 JS SDK 로더 — 지도 미리보기(components/pots/kakao-map-preview.tsx)에서 쓴다.
// 장소 검색(REST API, /api/places/search)과는 별개의 키(NEXT_PUBLIC_KAKAO_JS_KEY)를 쓴다 —
// 브라우저에 직접 노출되는 게 정상이며, 카카오 디벨로퍼스에서 도메인 등록으로 제한한다.
let loadPromise: Promise<any> | null = null

export function loadKakaoMaps(): Promise<any> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('브라우저 환경에서만 사용할 수 있습니다.'))
  }

  if (window.kakao?.maps) {
    return Promise.resolve(window.kakao)
  }

  if (loadPromise) return loadPromise

  const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY
  if (!appKey) {
    return Promise.reject(new Error('카카오맵 키가 설정되지 않았습니다.'))
  }

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.async = true
    script.onload = () => {
      window.kakao.maps.load(() => resolve(window.kakao))
    }
    script.onerror = () => {
      loadPromise = null
      reject(new Error('카카오맵을 불러오지 못했습니다.'))
    }
    document.head.appendChild(script)
  })

  return loadPromise
}
