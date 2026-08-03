'use client'

import { useState } from 'react'
import { Loader2, MapPin, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { searchPlaces } from '@/lib/api'
import type { Place } from '@/lib/types'

export function PlaceSearchDialog({
  open,
  onOpenChange,
  title,
  onSelect,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  onSelect: (place: Place) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Place[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    setError(null)
    try {
      const data = await searchPlaces(query)
      setResults(data)
      setSearched(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '검색에 실패했어요.')
    } finally {
      setLoading(false)
    }
  }

  function handleSelect(place: Place) {
    onSelect(place)
    onOpenChange(false)
    setQuery('')
    setResults([])
    setSearched(false)
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[80vh] flex-col sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSearch} className="flex gap-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="가게 이름이나 주소로 검색"
            className="h-11 rounded-xl"
          />
          <Button
            type="submit"
            size="icon"
            disabled={loading || !query.trim()}
            className="h-11 w-11 shrink-0 rounded-xl"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
          </Button>
        </form>

        <div className="-mx-4 min-h-0 flex-1 overflow-y-auto px-4">
          {error && <p className="py-6 text-center text-sm text-destructive">{error}</p>}
          {!error && searched && !loading && results.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">검색 결과가 없어요.</p>
          )}
          {!error && (
            <ul className="flex flex-col divide-y divide-border">
              {results.map((place) => (
                <li key={place.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(place)}
                    className="flex w-full items-start gap-2.5 py-3 text-left transition hover:bg-muted"
                  >
                    <MapPin className="mt-0.5 size-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{place.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{place.address}</p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
