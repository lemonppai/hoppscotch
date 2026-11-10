import { describe, expect, it } from "vitest"
import { UrlSource } from "../import-sources/UrlSource"

/**
 * The OpenAPI importer stamps `apiSpecSource` from the URL the document was
 * fetched from, so the step has to forward that URL alongside the payload —
 * without it the "Refresh from OpenAPI" entry never shows up on the imported
 * collection (the regression this covers).
 */
describe("UrlSource", () => {
  const setup = () => {
    const calls: Array<[string, string | undefined]> = []

    const step = UrlSource({
      caption: "import.from_url",
      description: "import.from_openapi_import_summary",
      onImportFromURL: (content: string, url?: string) => {
        calls.push([content, url])
      },
    })

    const props = step.props() as {
      onImportFromURL: (content: unknown, url: unknown) => void
    }

    return { calls, props }
  }

  it("forwards the fetched URL with the document", () => {
    const { calls, props } = setup()

    props.onImportFromURL(
      '{"openapi":"3.0.0"}',
      "https://api.example.com/openapi.json"
    )

    expect(calls).toEqual([
      ['{"openapi":"3.0.0"}', "https://api.example.com/openapi.json"],
    ])
  })

  it("drops an empty or non-string URL instead of forwarding junk", () => {
    const { calls, props } = setup()

    props.onImportFromURL("{}", "")
    props.onImportFromURL("{}", undefined)
    props.onImportFromURL("{}", 42)

    expect(calls).toEqual([
      ["{}", undefined],
      ["{}", undefined],
      ["{}", undefined],
    ])
  })

  it("ignores non-string payloads", () => {
    const { calls, props } = setup()

    props.onImportFromURL({ openapi: "3.0.0" }, "https://api.example.com/spec")

    expect(calls).toEqual([])
  })
})
