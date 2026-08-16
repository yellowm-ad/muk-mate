import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '먹메이트 · MukMate',
    short_name: '먹메이트',
    description: '전북대 학생용 공동주문 매칭 서비스 — 북대에서 같이 먹자!',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#f7f8f9',
    theme_color: '#FF6B00',
    lang: 'ko',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
