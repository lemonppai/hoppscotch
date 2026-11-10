import { beforeAll, describe, expect, it } from "vitest"
import * as E from "fp-ts/Either"
import type { HoppCollection, HoppRESTRequest } from "@hoppscotch/data"

type RefreshModule = typeof import("../openapi")

let refreshOpenAPICollection: RefreshModule["refreshOpenAPICollection"]
let mergeRefreshedCollection: RefreshModule["mergeRefreshedCollection"]
let REFRESH_FETCH_FAILED: RefreshModule["REFRESH_FETCH_FAILED"]
let REFRESH_PARSE_FAILED: RefreshModule["REFRESH_PARSE_FAILED"]
let REFRESH_NO_SOURCE: RefreshModule["REFRESH_NO_SOURCE"]

beforeAll(async () => {
  // The importer module spins up a validation Worker at import time and jsdom
  // has no Worker implementation; the refresh tests inject their own importer
  // so the stub never has to answer anything.
  if (typeof (globalThis as any).Worker === "undefined") {
    ;(globalThis as any).Worker = class {
      postMessage() {}
      terminate() {}
      addEventListener() {}
      removeEventListener() {}
    }
  }

  const mod = await import("../openapi")

  refreshOpenAPICollection = mod.refreshOpenAPICollection
  mergeRefreshedCollection = mod.mergeRefreshedCollection
  REFRESH_FETCH_FAILED = mod.REFRESH_FETCH_FAILED
  REFRESH_PARSE_FAILED = mod.REFRESH_PARSE_FAILED
  REFRESH_NO_SOURCE = mod.REFRESH_NO_SOURCE
}, 60000)

const request = (over: Partial<HoppRESTRequest> = {}): HoppRESTRequest =>
  ({
    v: "18",
    id: "req-id",
    _ref_id: "req-ref",
    name: "Get user",
    method: "GET",
    endpoint: "<<baseUrl>>/users/<<id>>",
    params: [],
    headers: [],
    auth: { authType: "none", authActive: true },
    body: { contentType: null, body: null },
    preRequestScript: "",
    testScript: "",
    requestVariables: [],
    responses: {},
    description: null,
    ...over,
  }) as unknown as HoppRESTRequest

const collection = (over: Partial<HoppCollection> = {}): HoppCollection =>
  ({
    v: 12,
    name: "User API",
    folders: [],
    requests: [],
    auth: { authType: "inherit", authActive: false },
    headers: [],
    variables: [],
    description: null,
    preRequestScript: "",
    testScript: "",
    _ref_id: "coll-ref",
    apiSpecSource: {
      type: "openapi-url",
      url: "https://example.com/openapi.json",
      syncedAt: "2026-01-01T00:00:00.000Z",
    },
    ...over,
  }) as unknown as HoppCollection

describe("mergeRefreshedCollection", () => {
  it("adds requests that only exist in the new spec", () => {
    const current = collection({
      requests: [request({ endpoint: "<<baseUrl>>/users" })],
    })
    const incoming = collection({
      requests: [
        request({ endpoint: "<<baseUrl>>/users" }),
        request({ endpoint: "<<baseUrl>>/orders", name: "List orders" }),
      ],
    })

    const { collection: merged, diff } = mergeRefreshedCollection(
      current,
      incoming
    )

    expect(diff.added).toBe(1)
    expect(diff.removed).toBe(0)
    expect(merged.requests).toHaveLength(2)
    expect(merged.requests.at(-1)).toMatchObject({
      endpoint: "<<baseUrl>>/orders",
      name: "List orders",
    })
  })

  it("updates a matching request but keeps its local identity", () => {
    const current = collection({
      requests: [
        request({
          id: "local-id",
          _ref_id: "local-ref",
          name: "Old summary",
          description: "old",
        }),
      ],
    })
    const incoming = collection({
      requests: [
        request({
          id: "generated-id",
          _ref_id: "generated-ref",
          name: "New summary",
          description: "fresh from the spec",
        }),
      ],
    })

    const { collection: merged, diff } = mergeRefreshedCollection(
      current,
      incoming
    )

    expect(diff.updated).toBe(1)
    expect(merged.requests[0]).toMatchObject({
      id: "local-id",
      _ref_id: "local-ref",
      name: "New summary",
      description: "fresh from the spec",
    })
  })

  it("counts untouched requests separately from changed ones", () => {
    const shape = { endpoint: "<<baseUrl>>/users", name: "Get user" }
    const { diff } = mergeRefreshedCollection(
      collection({ requests: [request(shape)] }),
      collection({ requests: [request(shape)] })
    )

    expect(diff.unchanged).toBe(1)
    expect(diff.updated).toBe(0)
  })

  it("keeps requests the spec no longer documents", () => {
    const current = collection({
      requests: [
        request({ endpoint: "<<baseUrl>>/users" }),
        request({ endpoint: "<<baseUrl>>/legacy", name: "Legacy" }),
      ],
    })
    const incoming = collection({
      requests: [request({ endpoint: "<<baseUrl>>/users" })],
    })

    const { collection: merged, diff } = mergeRefreshedCollection(
      current,
      incoming
    )

    expect(diff.removed).toBe(1)
    expect(merged.requests.map((r) => (r as HoppRESTRequest).endpoint)).toEqual(
      ["<<baseUrl>>/users", "<<baseUrl>>/legacy"]
    )
  })

  it("merges nested folders by name and keeps local-only folders", () => {
    const current = collection({
      folders: [
        collection({
          _ref_id: "folder-users",
          name: "Users",
          requests: [request({ endpoint: "<<baseUrl>>/users" })],
        }),
        collection({ _ref_id: "folder-local", name: "My Scratchpad" }),
      ],
    })
    const incoming = collection({
      folders: [
        collection({
          _ref_id: "generated-folder",
          name: "Users",
          requests: [
            request({ endpoint: "<<baseUrl>>/users" }),
            request({ endpoint: "<<baseUrl>>/users/<<id>>/orders" }),
          ],
        }),
        collection({ _ref_id: "folder-orders", name: "Orders" }),
      ],
    })

    const { collection: merged, diff } = mergeRefreshedCollection(
      current,
      incoming
    )

    expect(diff.foldersAdded).toBe(1)
    expect(merged.folders.map((f) => f.name)).toEqual([
      "Users",
      "Orders",
      "My Scratchpad",
    ])
    // local folder identity survives
    expect(merged.folders[0]._ref_id).toBe("folder-users")
    expect(merged.folders[0].requests).toHaveLength(2)
  })

  it("never overwrites collection-level config", () => {
    const current = collection({
      auth: { authType: "bearer", authActive: true, token: "<<token>>" },
      description: "Our internal notes",
    } as Partial<HoppCollection>)
    const incoming = collection({
      auth: { authType: "inherit", authActive: false },
      description: "spec description",
    })

    const { collection: merged } = mergeRefreshedCollection(current, incoming)

    expect(merged.auth).toMatchObject({
      authType: "bearer",
      token: "<<token>>",
    })
    expect(merged.description).toBe("Our internal notes")
    expect(merged._ref_id).toBe("coll-ref")
  })
})

describe("refreshOpenAPICollection", () => {
  it("re-fetches, merges and stamps the sync time", async () => {
    const current = collection({
      requests: [request({ endpoint: "<<baseUrl>>/users" })],
    })
    const incoming = collection({
      requests: [
        request({ endpoint: "<<baseUrl>>/users", name: "Renamed" }),
        request({ endpoint: "<<baseUrl>>/orders" }),
      ],
    })

    const result = await refreshOpenAPICollection(current, {
      fetchSpec: async () => "openapi: 3.0.0",
      importSpec: async () => E.right([incoming]),
    })

    expect(E.isRight(result)).toBe(true)
    if (!E.isRight(result)) throw new Error("unexpected left")

    expect(result.right.diff).toMatchObject({
      added: 1,
      updated: 1,
      removed: 0,
    })
    expect(result.right.collection.requests[0]).toMatchObject({
      name: "Renamed",
    })
    expect(result.right.collection.apiSpecSource?.syncedAt).not.toBe(
      current.apiSpecSource?.syncedAt
    )
  })

  it("reports fetch failures", async () => {
    const result = await refreshOpenAPICollection(collection(), {
      fetchSpec: async () => {
        throw new Error("network down")
      },
      importSpec: async () => E.right([]),
    })

    expect(result).toEqual(E.left(REFRESH_FETCH_FAILED))
  })

  it("reports parse failures from the importer", async () => {
    const result = await refreshOpenAPICollection(collection(), {
      fetchSpec: async () => "not a spec",
      importSpec: async () => E.left("openapi/invalid"),
    })

    expect(result).toEqual(E.left(REFRESH_PARSE_FAILED))
  })

  it("refuses collections without a source", async () => {
    const result = await refreshOpenAPICollection(
      collection({ apiSpecSource: null })
    )

    expect(result).toEqual(E.left(REFRESH_NO_SOURCE))
  })

  it("connects a collection to a URL supplied on first refresh", async () => {
    const current = collection({ apiSpecSource: null })
    const incoming = collection({
      requests: [request({ endpoint: "<<baseUrl>>/users" })],
    })

    const requested: string[] = []

    const result = await refreshOpenAPICollection(
      current,
      {
        fetchSpec: async (url) => {
          requested.push(url)
          return "openapi: 3.0.0"
        },
        importSpec: async () => E.right([incoming]),
      },
      { sourceUrl: "https://example.com/openapi.json" }
    )

    expect(requested).toEqual(["https://example.com/openapi.json"])
    expect(E.isRight(result)).toBe(true)
    if (!E.isRight(result)) throw new Error("unexpected left")

    // The URL is remembered, so the next refresh needs no prompt.
    expect(result.right.collection.apiSpecSource).toMatchObject({
      type: "openapi-url",
      url: "https://example.com/openapi.json",
    })
  })

  it("prefers an explicitly supplied URL over the stored one", async () => {
    const current = collection({
      apiSpecSource: {
        type: "openapi-url",
        url: "https://old.example.com/spec.json",
        syncedAt: new Date().toISOString(),
      },
    })

    const requested: string[] = []

    const result = await refreshOpenAPICollection(
      current,
      {
        fetchSpec: async (url) => {
          requested.push(url)
          return "openapi: 3.0.0"
        },
        importSpec: async () => E.right([collection()]),
      },
      { sourceUrl: "https://new.example.com/spec.json" }
    )

    expect(requested).toEqual(["https://new.example.com/spec.json"])
    if (!E.isRight(result)) throw new Error("unexpected left")
    expect(result.right.collection.apiSpecSource?.url).toBe(
      "https://new.example.com/spec.json"
    )
  })
})
