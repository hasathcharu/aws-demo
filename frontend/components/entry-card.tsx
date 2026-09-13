"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  entry: Entry
  onEdit: (entry: Entry) => void
  onDelete: (entry: Entry) => void
  busy: boolean
}

export function EntryCard({ entry, onEdit, onDelete, busy }: Props) {
  return (
    <Card>
      <CardContent className="flex gap-4">
        {entry.image_url && (
          // Plain <img> rather than next/image: the S3 bucket hostname comes
          // from an env var, so it cannot be listed in next.config remotePatterns.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={entry.image_url}
            alt={entry.title}
            className="size-24 shrink-0 rounded-md border object-cover"
          />
        )}

        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onEdit(entry)}
            className="text-left text-base font-medium hover:underline"
          >
            {entry.title}
          </button>

          <div className="mt-1 flex flex-wrap items-center gap-2">
            {entry.location && <Badge variant="secondary">{entry.location}</Badge>}
            <span className="text-sm text-muted-foreground">{formatDate(entry.entry_date)}</span>
          </div>

          {entry.note && (
            <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{entry.note}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          <Button variant="outline" size="sm" onClick={() => onEdit(entry)} disabled={busy}>
            Edit
          </Button>
          <Button variant="destructive" size="sm" onClick={() => onDelete(entry)} disabled={busy}>
            Delete
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
