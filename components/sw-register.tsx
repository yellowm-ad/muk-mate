'use client'

import { useEffect } from 'react'

/** PWA 설치 가능 자격을 채우기 위한 서비스워커 등록 — public/sw.js는 아무것도 캐싱하지 않는다. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return null
}
