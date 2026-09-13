"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"

import { deleteEntryAction } from "@/app/actions"
import { EntryCard } from "@/components/entry-card"
import { EntryForm } from "@/components/entry-form"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { Entry } from "@/lib/types"

// The Select needs a non-empty value, so "all" stands in for "no filter".
const ALL = "all"

type Props = {
  entries: Entry[]
  locations: string[]
  filter: string
  totalCount: number
  loadError: string
}

export function Journal({ entries, locations, filter, totalCount, loadError }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState<Entry | null>(null)
  const [error, setError] = useState("")

  // The form starts open only when there is nothing to look at yet; once there
  // are entries it stays out of the way until asked for.
  const [formOpen, setFormOpen] = useState(totalCount === 0)

  // Every server render hands down a fresh array, so comparing identities is how
  // this notices a save, delete or filter change and re-decides whether the form
  // should be open. It follows the journal as a whole: a filter that matches
  // nothing is not the same thing as an empty journal.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [renderedEntries, setRenderedEntries] = useState(entries)
  if (renderedEntries !== entries) {
    setRenderedEntries(entries)
    setFormOpen(totalCount === 0)
  }

  function handleFilterChange(value: string) {
    startTransition(() => {
      router.push(value === ALL ? "/" : `/?location=${encodeURIComponent(value)}`)
    })
  }

  function handleSaved() {
    setEditing(null)
    setError("")
  }

  function handleEdit(entry: Entry) {
    setEditing(entry)
    setFormOpen(true)
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  function handleCancel() {
    setEditing(null)
    setFormOpen(totalCount === 0)
  }

  async function handleDelete(entry: Entry) {
    if (!confirm(`Delete "${entry.title}"?`)) return

    const result = await deleteEntryAction(entry.id)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (editing?.id === entry.id) setEditing(null)
    setError("")
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold">Travel Journal</h1>
        <p className="text-sm text-muted-foreground">A photo log of where you have been.</p>
      </header>

      <Card className="py-0">
        <CardContent className="px-0">
          <Accordion
            type="single"
            collapsible
            value={formOpen ? "form" : ""}
            onValueChange={(value) => setFormOpen(value === "form")}
          >
            <AccordionItem value="form" className="border-b-0">
              <AccordionTrigger className="px-6 hover:no-underline">
                {editing ? `Edit "${editing.title}"` : "Add an entry"}
              </AccordionTrigger>
              <AccordionContent className="px-6">
                {/* The key remounts the form whenever the target changes, so it
                    loads the new values without any reset logic. */}
                <EntryForm
                  key={editing ? `edit-${editing.id}` : "new"}
                  editing={editing}
                  onSaved={handleSaved}
                  onCancel={handleCancel}
                />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      <div className="mt-10 mb-4 flex items-center justify-between gap-4">
        <h2 className="text-lg font-medium">
          Entries <span className="text-muted-foreground">({entries.length})</span>
        </h2>

        <Select value={filter || ALL} onValueChange={handleFilterChange}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Filter by location" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All locations</SelectItem>
            {locations.map((location) => (
              <SelectItem key={location} value={location}>
                {location}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {(loadError || error) && (
        <p className="text-sm text-destructive">{loadError || error}</p>
      )}

      {!loadError && entries.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {filter
            ? `No entries in ${filter}.`
            : "No entries yet. Add your first trip above."}
        </p>
      )}

      <div className="grid gap-3">
        {entries.map((entry) => (
          <EntryCard
            key={entry.id}
            entry={entry}
            onEdit={handleEdit}
            onDelete={handleDelete}
            busy={pending}
          />
        ))}
      </div>
    </main>
  )
}
