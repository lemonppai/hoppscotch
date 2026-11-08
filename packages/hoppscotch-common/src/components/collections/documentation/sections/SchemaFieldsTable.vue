<template>
  <div v-if="fields && fields.length > 0" class="space-y-2">
    <div class="flex items-center justify-between gap-2">
      <h3
        v-if="title"
        class="text-xs font-semibold text-secondaryLight uppercase tracking-wide"
      >
        {{ title }}
      </h3>
      <div class="flex items-center gap-3 ml-auto">
        <button
          v-if="hasNestedFields"
          class="text-tiny text-secondaryLight hover:text-accent transition"
          @click="toggleAll"
        >
          {{
            allCollapsed
              ? t("documentation.schema_fields.expand")
              : t("documentation.schema_fields.collapse")
          }}
        </button>
        <button
          class="flex items-center gap-1 text-tiny text-secondaryLight hover:text-accent transition"
          :title="t('documentation.schema_fields.copy')"
          @click="copyDocumentation"
        >
          <icon-lucide-copy class="w-3 h-3" />
          {{ t("documentation.schema_fields.copy") }}
        </button>
      </div>
    </div>
    <table class="w-full border-collapse text-sm">
      <thead class="bg-divider/20">
        <tr>
          <th
            class="text-left py-2 px-3 font-semibold text-secondaryDark text-xs"
          >
            {{ t("documentation.schema_fields.field") }}
          </th>
          <th
            class="text-left py-2 px-3 font-semibold text-secondaryDark text-xs"
          >
            {{ t("documentation.schema_fields.type") }}
          </th>
          <th
            class="text-left py-2 px-3 font-semibold text-secondaryDark text-xs"
          >
            {{ t("documentation.schema_fields.required") }}
          </th>
          <th
            class="text-left py-2 px-3 font-semibold text-secondaryDark text-xs"
          >
            {{ t("documentation.schema_fields.description") }}
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in rows" :key="row.key" class="border-t border-divider">
          <td
            class="py-2 px-3 font-mono text-xs text-accent break-all align-top"
            :style="{ paddingLeft: `${12 + row.depth * 18}px` }"
          >
            <div class="flex items-start">
              <button
                v-if="row.expandable"
                class="mr-1 mt-0.5 flex-shrink-0 text-secondaryLight hover:text-accent transition"
                :aria-label="
                  row.collapsed
                    ? t('documentation.schema_fields.expand')
                    : t('documentation.schema_fields.collapse')
                "
                @click="toggle(row.key)"
              >
                <icon-lucide-chevron-right
                  class="w-3 h-3 transition-transform"
                  :class="{ 'rotate-90': !row.collapsed }"
                />
              </button>
              <span v-else class="mr-1 inline-block w-3 flex-shrink-0" />
              <span class="break-all">{{ row.name }}</span>
            </div>
          </td>
          <td class="py-2 px-3 font-mono text-xs text-secondaryLight align-top">
            {{ row.type }}
          </td>
          <td class="py-2 px-3 align-top">
            <span
              class="px-2 py-0.5 text-xs rounded"
              :class="
                row.required
                  ? 'bg-red-500/20 text-red-500'
                  : 'bg-secondaryLight/20 text-secondaryLight'
              "
            >
              {{
                row.required ? t("documentation.yes") : t("documentation.no")
              }}
            </span>
          </td>
          <td
            class="py-2 px-3 text-secondaryLight text-xs whitespace-pre-wrap align-top"
          >
            {{ row.description }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script lang="ts" setup>
import { computed, ref, watch } from "vue"
import IconLucideChevronRight from "~icons/lucide/chevron-right"
import IconLucideCopy from "~icons/lucide/copy"
import type { HoppSchemaField } from "@hoppscotch/data"
import { useI18n } from "~/composables/i18n"
import { useToast } from "~/composables/toast"

const props = defineProps<{
  fields?: HoppSchemaField[] | null
  title?: string
}>()

const t = useI18n()
const toast = useToast()

type Row = {
  /** Stable identity so expand state survives re-renders */
  key: string
  name: string
  type: string
  required: boolean
  description: string
  depth: number
  expandable: boolean
  collapsed: boolean
}

/** Keys of collapsed rows. Everything is expanded by default. */
const collapsedKeys = ref<Set<string>>(new Set())

const hasNestedFields = computed(() => collectKeys(props.fields ?? []).size > 0)

const allCollapsed = computed(
  () =>
    hasNestedFields.value &&
    [...collectKeys(props.fields ?? [])].every((key) =>
      collapsedKeys.value.has(key)
    )
)

function collectKeys(
  fields: HoppSchemaField[],
  prefix = "",
  acc: Set<string> = new Set()
): Set<string> {
  fields.forEach((field, index) => {
    const key = `${prefix}${index}:${field.name}`
    if (field.children && field.children.length > 0) {
      acc.add(key)
      collectKeys(field.children, `${key}/`, acc)
    }
  })
  return acc
}

const rows = computed<Row[]>(() => {
  const out: Row[] = []

  const walk = (fields: HoppSchemaField[], depth: number, prefix: string) => {
    fields.forEach((field, index) => {
      const key = `${prefix}${index}:${field.name}`
      const children = field.children ?? []
      const collapsed = collapsedKeys.value.has(key)

      out.push({
        key,
        name: field.name,
        type: field.type,
        required: field.required,
        description: field.description,
        depth,
        expandable: children.length > 0,
        collapsed,
      })

      if (children.length > 0 && !collapsed) {
        walk(children, depth + 1, `${key}/`)
      }
    })
  }

  walk(props.fields ?? [], 0, "")
  return out
})

const toggle = (key: string) => {
  const next = new Set(collapsedKeys.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  collapsedKeys.value = next
}

const toggleAll = () => {
  collapsedKeys.value = allCollapsed.value
    ? new Set()
    : collectKeys(props.fields ?? [])
}

// A freshly imported / switched request must not inherit stale expand state
watch(
  () => props.fields,
  () => {
    collapsedKeys.value = new Set()
  }
)

const isArrayField = (field: HoppSchemaField) => field.type.startsWith("array<")

/**
 * Render the whole field tree (regardless of collapse state) as a Markdown
 * table. Nested names use path notation — `list[].id`, `list[].profile.nickname`
 * — so the copied snippet stays unambiguous once flattened into a table.
 */
const toMarkdown = (): string => {
  const escapeCell = (value: string) =>
    value.replace(/\|/g, "\\|").replace(/\r?\n/g, "<br>").trim()

  const lines: string[] = []

  if (props.title) lines.push(`### ${props.title}`, "")

  lines.push(
    `| ${t("documentation.schema_fields.field")} | ${t(
      "documentation.schema_fields.type"
    )} | ${t("documentation.schema_fields.required")} | ${t(
      "documentation.schema_fields.description"
    )} |`,
    "| --- | --- | --- | --- |"
  )

  const walk = (fields: HoppSchemaField[], parentPath: string) => {
    fields.forEach((field) => {
      const path = parentPath ? `${parentPath}.${field.name}` : field.name

      lines.push(
        `| ${escapeCell(path)} | ${escapeCell(field.type)} | ${
          field.required ? t("documentation.yes") : t("documentation.no")
        } | ${escapeCell(field.description)} |`
      )

      const children = field.children ?? []
      if (children.length > 0) {
        walk(children, isArrayField(field) ? `${path}[]` : path)
      }
    })
  }

  walk(props.fields ?? [], "")

  return lines.join("\n")
}

/** Fallback for insecure contexts where the async clipboard API is missing */
const copyWithTextarea = (content: string) => {
  const textarea = document.createElement("textarea")
  textarea.value = content
  textarea.setAttribute("readonly", "")
  textarea.style.position = "fixed"
  textarea.style.opacity = "0"
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand("copy")
  document.body.removeChild(textarea)
}

const copyDocumentation = async () => {
  const content = toMarkdown()

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(content)
    } else {
      copyWithTextarea(content)
    }
    toast.success(t("documentation.schema_fields.copied"))
  } catch (_e) {
    try {
      copyWithTextarea(content)
      toast.success(t("documentation.schema_fields.copied"))
    } catch (err) {
      console.error("Failed to copy schema fields: ", err)
      toast.error(t("documentation.schema_fields.copy_failed"))
    }
  }
}
</script>
