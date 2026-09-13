// Every call to the Go service goes through this module.
//
// The "server-only" import is the guard rail: if any client component ever
// imports this file, the build fails instead of quietly shipping the private
// service's URL to the browser.
import "server-only"

import type { Entry, EntryInput, Presign } from "@/lib/types"

export type { Entry, EntryInput, Presign }

// No NEXT_PUBLIC_ prefix on purpose. The Go service listens on a private
// subnet, so only this Next.js server can reach it, and only the server needs
// to know where it is.
const API_URL = process.env.API_URL || "http://localhost:8080"

// request talks to the Go service and turns its { "error": "..." } responses
// into thrown Errors.
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    // Journal entries change on every write, so never serve a cached list.
    cache: "no-store",
    ...options,
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    throw new Error(body?.error || `Request failed with status ${response.status}`)
  }
  return body as T
}

export function listEntries(location: string): Promise<Entry[]> {
  const query = location ? `?location=${encodeURIComponent(location)}` : ""
  return request<Entry[]>(`/api/entries${query}`)
}

export function createEntry(input: EntryInput): Promise<Entry> {
  return request<Entry>("/api/entries", {
    method: "POST",
    body: JSON.stringify(input),
  })
}

export function updateEntry(id: number, input: EntryInput): Promise<Entry> {
  return request<Entry>(`/api/entries/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  })
}

export function deleteEntry(id: number): Promise<{ status: string }> {
  return request<{ status: string }>(`/api/entries/${id}`, { method: "DELETE" })
}

// presignUpload asks the Go service for a short-lived S3 PUT URL. The browser
// uses that URL directly, so photo bytes never pass through either server.
export function presignUpload(filename: string, contentType: string): Promise<Presign> {
  return request<Presign>("/api/uploads/presign", {
    method: "POST",
    body: JSON.stringify({ filename, contentType }),
  })
}
