"use server";

import { requireAdmin } from "@/lib/auth/dal";
import { searchIndex, type SearchItem } from "@/lib/search";

/** Clients and associates for the command palette, fetched each time it opens so it is never stale. */
export async function searchIndexAction(): Promise<SearchItem[]> {
  await requireAdmin();
  return searchIndex();
}
