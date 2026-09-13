import { Journal } from "@/components/journal"
import { listEntries } from "@/lib/api"
import type { Entry } from "@/lib/types"

// This is a Server Component: the fetches below run on the Next.js server and
// reach the Go service over the private network. The browser only ever receives
// the rendered result.
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ location?: string }>
}) {
  const { location = "" } = await searchParams

  let entries: Entry[] = []
  let locations: string[] = []
  let totalCount = 0
  let error = ""

  try {
    entries = await listEntries(location)

    // The unfiltered list fills the filter dropdown and tells the page whether
    // the journal is empty overall, so fetch it too whenever a filter is on.
    const all = location ? await listEntries("") : entries
    totalCount = all.length

    const inUse = new Set(all.map((entry) => entry.location).filter(Boolean))
    // Keep the active filter selectable even after its last entry is deleted,
    // otherwise the dropdown renders blank with no obvious way back.
    if (location) inUse.add(location)
    locations = [...inUse].sort()
  } catch (err) {
    error = err instanceof Error ? err.message : "Could not reach the journal service"
  }

  return (
    <Journal
      entries={entries}
      locations={locations}
      filter={location}
      totalCount={totalCount}
      loadError={error}
    />
  )
}
