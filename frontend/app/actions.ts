"use server"

import { revalidatePath } from "next/cache"

import {
  createEntry,
  deleteEntry,
  presignUpload,
  updateEntry,
  type EntryInput,
  type Presign,
} from "@/lib/api"

// Server actions are the only way the browser can reach the Go service. Each
// one runs on the Next.js server, calls across the VPC, and refreshes the page
// data. Failures come back as a value so the form can show them inline.
export type Result<T = null> = { ok: true; data: T } | { ok: false; error: string }

function failed(err: unknown, fallback: string): Result<never> {
  return { ok: false, error: err instanceof Error ? err.message : fallback }
}

export async function saveEntryAction(
  id: number | null,
  input: EntryInput,
): Promise<Result> {
  try {
    if (id === null) {
      await createEntry(input)
    } else {
      await updateEntry(id, input)
    }
    revalidatePath("/")
    return { ok: true, data: null }
  } catch (err) {
    return failed(err, "Could not save the entry")
  }
}

export async function deleteEntryAction(id: number): Promise<Result> {
  try {
    await deleteEntry(id)
    revalidatePath("/")
    return { ok: true, data: null }
  } catch (err) {
    return failed(err, "Could not delete the entry")
  }
}

export async function presignPhotoAction(
  filename: string,
  contentType: string,
): Promise<Result<Presign>> {
  try {
    return { ok: true, data: await presignUpload(filename, contentType) }
  } catch (err) {
    return failed(err, "Could not start the photo upload")
  }
}
