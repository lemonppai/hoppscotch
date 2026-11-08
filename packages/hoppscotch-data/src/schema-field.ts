import { z } from "zod"

/**
 * A single schema field extracted from an OpenAPI schema object.
 * Used to render Apifox-style field tables (name / type / required /
 * description) in the documentation preview for request bodies and responses.
 *
 * `children` holds the nested properties of object fields (and of the item
 * object of array fields) so the UI can render an expandable tree instead of
 * a flat list. The tree is already materialised at import time — keep the
 * depth bounded there, never resolve it lazily here.
 *
 * Lives in its own module so both the REST request schema (`apiSpecMeta`) and
 * the request/response schema can reference it without creating an import
 * cycle between them.
 */
export type HoppSchemaField = {
  name: string
  type: string
  required: boolean
  description: string
  children?: HoppSchemaField[]
}

// Recursive schema: `z.lazy` defers evaluation so the definition can reference
// itself. Only used for validation, never for JSON-schema generation.
// The input side is `unknown` because the inner `.catch()` fallbacks accept
// arbitrary values; the parsed output is always a `HoppSchemaField`.
export const HoppSchemaField: z.ZodType<
  HoppSchemaField,
  z.ZodTypeDef,
  unknown
> = z.lazy(() =>
  z.object({
    name: z.string().catch(""),
    type: z.string().catch(""),
    required: z.boolean().catch(false),
    description: z.string().catch(""),
    children: z.array(HoppSchemaField).optional().catch(undefined),
  })
)
