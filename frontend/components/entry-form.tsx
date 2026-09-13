"use client"

import { useRef, useState } from "react"

import { presignPhotoAction, saveEntryAction } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { Entry } from "@/lib/types"
import { cn } from "@/lib/utils"

const today = () => new Date().toISOString().slice(0, 10)

// Must match the content types the Go service's presign endpoint accepts.
const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"]

type Props = {
  editing: Entry | null
  onSaved: () => void
  onCancel: () => void
}

export function EntryForm({ editing, onSaved, onCancel }: Props) {
  // The parent remounts this component (via its key) whenever the entry being
  // edited changes, so the initial state is all the loading it needs to do.
  const [title, setTitle] = useState(editing?.title ?? "")
  const [location, setLocation] = useState(editing?.location ?? "")
  const [entryDate, setEntryDate] = useState(editing?.entry_date ?? today())
  const [note, setNote] = useState(editing?.note ?? "")
  const [imageUrl, setImageUrl] = useState(editing?.image_url ?? "")
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  function clearForm() {
    setTitle("")
    setLocation("")
    setEntryDate(today())
    setNote("")
    setImageUrl("")
    setError("")
    if (fileInput.current) fileInput.current.value = ""
  }

  // Two steps: a server action asks the Go service for a presigned URL, then the
  // browser PUTs the file straight to S3. The bytes never touch either server.
  async function handleFile(file: File | undefined) {
    if (!file) return

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Photos must be a PNG, JPEG or WebP image")
      if (fileInput.current) fileInput.current.value = ""
      return
    }

    setUploading(true)
    setError("")
    try {
      const result = await presignPhotoAction(file.name, file.type)
      if (!result.ok) throw new Error(result.error)

      const upload = await fetch(result.data.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      })
      if (!upload.ok) throw new Error(`Upload to S3 failed with status ${upload.status}`)

      setImageUrl(result.data.fileUrl)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Photo upload failed")
      if (fileInput.current) fileInput.current.value = ""
    } finally {
      setUploading(false)
    }
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault()
    setDragging(false)
    if (!uploading) handleFile(event.dataTransfer.files?.[0])
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError("")

    const input = { title, location, note, entry_date: entryDate, image_url: imageUrl }
    const result = await saveEntryAction(editing?.id ?? null, input)
    setSaving(false)

    if (!result.ok) {
      setError(result.error)
      return
    }

    // An edit ends with the parent remounting this component; a fresh entry
    // stays put, so it clears the form itself for the next one.
    if (!editing) clearForm()
    onSaved()
  }

  return (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-2">
        <Label htmlFor="title">Title</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sunrise over Fushimi Inari"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <Label htmlFor="location">Location</Label>
          <Input
            id="location"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Kyoto, Japan"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="entry-date">Date</Label>
          <Input
            id="entry-date"
            type="date"
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="note">Note</Label>
        <Textarea
          id="note"
          rows={4}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What happened, who you met, what it smelled like."
        />
      </div>

      <div className="grid gap-2">
        <Label htmlFor="photo">Photo</Label>

        {/* The drop zone doubles as the file picker: clicking anywhere in it
            opens the hidden input that actually holds the file. */}
        <div
          onClick={() => fileInput.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
            dragging ? "border-primary bg-muted" : "border-input hover:bg-muted/50",
            uploading && "pointer-events-none opacity-60",
          )}
        >
          <input
            id="photo"
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
            disabled={uploading}
          />

          {uploading ? (
            <p className="text-sm text-muted-foreground">Uploading photo…</p>
          ) : imageUrl ? (
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt="Selected"
                className="size-16 rounded-md border object-cover"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setImageUrl("")
                  if (fileInput.current) fileInput.current.value = ""
                }}
              >
                Remove photo
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm font-medium">Drop a photo here</p>
              <p className="text-xs text-muted-foreground">
                or click to browse — PNG, JPEG or WebP
              </p>
            </>
          )}
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2">
        <Button type="submit" disabled={uploading || saving}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add entry"}
        </Button>
        {editing && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        )}
      </div>
    </form>
  )
}
