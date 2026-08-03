'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'

import { loadKakaoMaps } from '@/lib/kakao-maps-loader'

/** 당근마켓처럼 주소 입력란 밑에 선택한 장소를 시각적으로 보여주는 지도 미리보기 */
export function KakaoMapPreview({ lat, lng, name }: { lat: number; lng: number; name?: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markerRef = useRef<any>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    loadKakaoMaps()
      .then((kakao) => {
        if (cancelled || !containerRef.current) return
        const center = new kakao.maps.LatLng(lat, lng)

        if (!mapRef.current) {
          mapRef.current = new kakao.maps.Map(containerRef.current, { center, level: 3 })
          markerRef.current = new kakao.maps.Marker({ position: center, map: mapRef.current })
        } else {
          mapRef.current.setCenter(center)
          markerRef.current.setPosition(center)
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '지도를 불러오지 못했어요.')
      })

    return () => {
      cancelled = true
    }
  }, [lat, lng])

  if (error) {
    return (
      <div className="flex h-40 items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 text-xs text-muted-foreground">
        <AlertCircle className="size-3.5" />
        {error}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={name ? `${name} 위치 지도` : '선택한 위치 지도'}
      className="h-40 w-full overflow-hidden rounded-xl border border-border bg-muted/40"
    />
  )
}
