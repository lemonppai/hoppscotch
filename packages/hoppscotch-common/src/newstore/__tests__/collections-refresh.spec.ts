import { beforeEach, describe, expect, test, vi } from "vitest"

// Same cycle edge as the other newstore tests: collections → services/tab/rest
// → services/persistence → collections.
vi.mock("~/services/tab/rest", () => ({
  RESTTabService: class MockRESTTabService {
    static ID = "REST_TAB_SERVICE"
  },
}))
vi.mock("~/modules/i18n", () => ({ getI18n: () => (k: string) => k }))

import {
  replaceRESTCollectionByRefId,
  restCollectionStore,
  setRESTCollections,
} from "~/newstore/collections"

const makeCollection = (refId: string, name: string, folders: unknown[] = []) =>
  ({
    v: 12,
    _ref_id: refId,
    name,
    folders,
    requests: [],
    headers: [],
    variables: [],
    auth: { authType: "inherit", authActive: true },
    description: null,
    preRequestScript: "",
    testScript: "",
  }) as any

const state = () => restCollectionStore.value.state as any[]

describe("replaceRESTCollectionByRefId", () => {
  beforeEach(() => {
    setRESTCollections([
      makeCollection("coll-a", "A"),
      makeCollection("coll-b", "B"),
    ])
  })

  test("swaps a root collection in place and keeps the others", () => {
    const refreshed = {
      ...makeCollection("coll-a", "A refreshed"),
      apiSpecSource: { type: "openapi-url", url: "u", syncedAt: "s" },
    }

    expect(replaceRESTCollectionByRefId(refreshed)).toBe(true)

    expect(state()[0].name).toBe("A refreshed")
    expect(state()[0].apiSpecSource).toEqual({
      type: "openapi-url",
      url: "u",
      syncedAt: "s",
    })
    expect(state()[1].name).toBe("B")
  })

  test("swaps a nested folder by ref id", () => {
    setRESTCollections([
      makeCollection("root", "Root", [makeCollection("folder-1", "Ops")]),
    ])

    expect(
      replaceRESTCollectionByRefId(makeCollection("folder-1", "Operations"))
    ).toBe(true)

    expect(state()[0].folders[0].name).toBe("Operations")
    expect(state()[0].name).toBe("Root")
  })

  test("reports false when the collection is gone", () => {
    expect(replaceRESTCollectionByRefId(makeCollection("nope", "X"))).toBe(
      false
    )
    expect(state().map((collection) => collection.name)).toEqual(["A", "B"])
  })
})
