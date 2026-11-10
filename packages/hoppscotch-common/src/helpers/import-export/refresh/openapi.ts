import axios from "axios"
import * as E from "fp-ts/Either"
import type {
  HoppCollection,
  HoppGQLRequest,
  HoppRESTRequest,
} from "@hoppscotch/data"
import { hoppOpenAPIImporter } from "../import/openapi"

export const REFRESH_NO_SOURCE = "refresh/no_source" as const
export const REFRESH_FETCH_FAILED = "refresh/fetch_failed" as const
export const REFRESH_PARSE_FAILED = "refresh/parse_failed" as const
export const REFRESH_EMPTY_SPEC = "refresh/empty_spec" as const

export type RefreshCollectionError =
  | typeof REFRESH_NO_SOURCE
  | typeof REFRESH_FETCH_FAILED
  | typeof REFRESH_PARSE_FAILED
  | typeof REFRESH_EMPTY_SPEC

export type RefreshCollectionDiff = {
  /** Requests that only exist in the freshly pulled spec */
  added: number
  /** Requests present in both, whose definition actually changed */
  updated: number
  /** Requests that survived the refresh untouched */
  unchanged: number
  /** Requests that vanished from the spec and were kept locally */
  removed: number
  /** Folders that only exist in the freshly pulled spec */
  foldersAdded: number
}

export type RefreshCollectionResult = {
  collection: HoppCollection
  diff: RefreshCollectionDiff
}

const isRESTRequest = (
  request: HoppRESTRequest | HoppGQLRequest
): request is HoppRESTRequest => "endpoint" in request && !!request.endpoint

/**
 * Identity of an imported request across spec revisions.
 * The endpoint is stable for a given spec+server pair, and method+endpoint
 * survives renames of the operation (summary/title changes are very common
 * between spec revisions, so name is a poor key).
 */
const requestKey = (request: HoppRESTRequest) =>
  `${request.method.toUpperCase()} ${request.endpoint}`

const mergeRequests = (
  current: (HoppRESTRequest | HoppGQLRequest)[],
  incoming: (HoppRESTRequest | HoppGQLRequest)[],
  diff: RefreshCollectionDiff
): (HoppRESTRequest | HoppGQLRequest)[] => {
  const currentREST = current.filter(isRESTRequest)
  const byKey = new Map(
    currentREST.map((request) => [requestKey(request), request])
  )
  const matched = new Set<string>()

  const merged = incoming.map((incomingRequest) => {
    if (!isRESTRequest(incomingRequest)) return incomingRequest

    const key = requestKey(incomingRequest)
    const existing = byKey.get(key)

    if (!existing) {
      diff.added++
      return incomingRequest
    }

    matched.add(key)

    const { id: _oldId, _ref_id: _oldRef, ...oldShape } = existing
    const { id: _newId, _ref_id: _newRef, ...newShape } = incomingRequest

    if (JSON.stringify(oldShape) === JSON.stringify(newShape)) {
      diff.unchanged++
    } else {
      diff.updated++
    }

    // Keep local identity so open tabs, history entries and MQTT/socket
    // sessions keep pointing at the same request; everything else follows
    // the spec.
    return {
      ...incomingRequest,
      id: existing.id,
      _ref_id: existing._ref_id,
    }
  })

  // Requests the spec no longer documents are kept (never silently dropped):
  // users may have local edits or scripts attached to them, and removing
  // requests invalidates save contexts of open tabs.
  const kept = currentREST.filter(
    (request) => !matched.has(requestKey(request))
  )
  diff.removed += kept.length

  // Non-REST leftovers (a GQL request hand-added to an imported collection)
  const nonREST = current.filter((request) => !isRESTRequest(request))

  return [...merged, ...kept, ...nonREST]
}

const mergeCollections = (
  current: HoppCollection,
  incoming: HoppCollection,
  diff: RefreshCollectionDiff
): HoppCollection => {
  const incomingFolderNames = new Set(
    incoming.folders.map((folder) => folder.name)
  )
  const currentFoldersByName = new Map(
    current.folders.map((folder) => [folder.name, folder])
  )

  const mergedFolders = incoming.folders.map((incomingFolder) => {
    const existing = currentFoldersByName.get(incomingFolder.name)

    if (!existing) {
      diff.foldersAdded++
      return incomingFolder
    }

    return mergeCollections(existing, incomingFolder, diff)
  })

  // Folders that disappeared from the spec stay in place (same reasoning as
  // requests): the spec is a source, not the owner, of the local collection.
  const keptFolders = current.folders.filter(
    (folder) => !incomingFolderNames.has(folder.name)
  )

  return {
    ...current,
    // Collection-level auth/headers/variables/scripts are user configuration
    // (tokens, environment plumbing), so they are never overwritten here.
    requests: mergeRequests(current.requests, incoming.requests, diff),
    folders: [...mergedFolders, ...keptFolders],
  }
}

/**
 * Merges a freshly imported collection tree into an existing one, keeping
 * local identity (ids, ref ids) and every request/folder the spec dropped.
 * Exported for tests.
 */
export const mergeRefreshedCollection = (
  current: HoppCollection,
  incoming: HoppCollection
): RefreshCollectionResult => {
  const diff: RefreshCollectionDiff = {
    added: 0,
    updated: 0,
    unchanged: 0,
    removed: 0,
    foldersAdded: 0,
  }

  return {
    collection: mergeCollections(current, incoming, diff),
    diff,
  }
}

export type RefreshCollectionDeps = {
  fetchSpec: (url: string) => Promise<string>
  importSpec: (content: string) => Promise<E.Either<string, HoppCollection[]>>
}

const defaultDeps: RefreshCollectionDeps = {
  fetchSpec: async (url) => {
    const response = await axios.get(url, {
      responseType: "text",
      transitional: { forcedJSONParsing: false },
    })

    return typeof response.data === "string"
      ? response.data
      : JSON.stringify(response.data)
  },
  importSpec: async (content) => hoppOpenAPIImporter([content])(),
}

export type RefreshCollectionOptions = {
  /**
   * Pull from this URL instead of `collection.apiSpecSource.url`. Used when a
   * collection predates source tracking (or was imported from a file) and the
   * user supplies the URL on first refresh; the URL is then persisted as the
   * collection's source.
   */
  sourceUrl?: string
}

/**
 * Re-fetches the OpenAPI document a collection was imported from and merges
 * it into the collection.
 */
export const refreshOpenAPICollection = async (
  collection: HoppCollection,
  deps: RefreshCollectionDeps = defaultDeps,
  options: RefreshCollectionOptions = {}
): Promise<E.Either<RefreshCollectionError, RefreshCollectionResult>> => {
  const url = options.sourceUrl ?? collection.apiSpecSource?.url

  if (!url) {
    return E.left(REFRESH_NO_SOURCE)
  }

  let content: string

  try {
    content = await deps.fetchSpec(url)
  } catch {
    return E.left(REFRESH_FETCH_FAILED)
  }

  const imported = await deps.importSpec(content)

  if (E.isLeft(imported)) {
    return E.left(REFRESH_PARSE_FAILED)
  }

  // A single spec can produce several root collections (one per document).
  // Prefer the one this collection came from, matched by name.
  const incoming =
    imported.right.find((candidate) => candidate.name === collection.name) ??
    imported.right[0]

  if (!incoming) {
    return E.left(REFRESH_EMPTY_SPEC)
  }

  const result = mergeRefreshedCollection(collection, incoming)

  return E.right({
    collection: {
      ...result.collection,
      apiSpecSource: {
        type: "openapi-url",
        url,
        syncedAt: new Date().toISOString(),
      },
    },
    diff: result.diff,
  })
}
