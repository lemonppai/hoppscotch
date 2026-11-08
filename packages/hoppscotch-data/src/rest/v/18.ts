import { z } from "zod"
import { defineVersion } from "verzod"
import { V17_SCHEMA } from "./17"
import { HoppSchemaField } from "../../schema-field"

export { HoppSchemaField } from "../../schema-field"

/**
 * OpenAPI-derived documentation metadata that has no natural home in the
 * request/response models (requestBody description, request body schema field
 * table). Entirely optional: legacy requests simply don't carry it.
 *
 * Response schema field tables live on the response objects themselves
 * (`HoppRESTRequestResponse.schemaFields`) so the documentation and the
 * example response panels can render them without a lookup.
 */
export const HoppAPISpecMeta = z.object({
  requestBodyDescription: z.string().catch(""),
  bodySchemaFields: z.array(HoppSchemaField).catch([]),
})

export type HoppAPISpecMeta = z.infer<typeof HoppAPISpecMeta>

export const V18_SCHEMA = V17_SCHEMA.extend({
  v: z.literal("18"),
  apiSpecMeta: HoppAPISpecMeta.optional(),
})

const V18_VERSION = defineVersion({
  schema: V18_SCHEMA,
  initial: false,
  up(old: z.infer<typeof V17_SCHEMA>) {
    return {
      ...old,
      v: "18" as const,
    }
  },
})

export default V18_VERSION
