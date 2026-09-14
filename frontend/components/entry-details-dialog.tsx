"use client"

import { useEffect } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { Entry } from "@/lib/types"

// "2024-03-18" -> "18 Mar 2024". The T00:00:00 keeps the browser from shifting
// the date into the previous day in western time zones.
function formatDate(value: string) {
  const date = new Date(`${value}T00:00:00`)
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  })
}

type Props = {
  entry: Entry | null
  onClose: () => void
}

export function EntryDetailsDialog({ entry, onClose }: Props) {
  useEffect(() => {
    if (!entry) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose()
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [entry, onClose])

  if (!entry) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="entry-details-title"
        className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-card text-card-foreground shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-4">
          <div className="min-w-0">
            <h2 id="entry-details-title" className="text-xl font-semibold">
              {entry.title}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {entry.location && <Badge variant="secondary">{entry.location}</Badge>}
              <span className="text-sm text-muted-foreground">
                {formatDate(entry.entry_date)}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Close entry details"
            onClick={onClose}
          >
            <span aria-hidden="true" className="text-xl leading-none">×</span>
          </Button>
        </div>

        {entry.image_url && (
          // Plain <img> rather than next/image: the S3 bucket hostname comes
          // from an env var, so it cannot be listed in next.config remotePatterns.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.image_url}
            alt={entry.title}
            className="max-h-[55vh] w-full object-contain bg-muted"
          />
        )}

        {entry.note && (
          <p className="whitespace-pre-wrap p-6 text-sm leading-6 text-muted-foreground">
            {entry.note}
          </p>
        )}
      </section>
    </div>
  )
}
