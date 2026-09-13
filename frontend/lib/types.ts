// Shapes shared by the server and the browser. Kept apart from lib/api.ts so
// client components can use them without pulling in the server-only module.

export type Entry = {
  id: number
  title: string
  location: string
  note: string
  entry_date: string
  image_url: string
  created_at?: string
}

export type EntryInput = {
  title: string
  location: string
  note: string
  entry_date: string
  image_url: string
}

export type Presign = {
  uploadUrl: string
  fileUrl: string
}
