import { describe, expect, it, vi } from "vitest"
import { createApp, h, nextTick } from "vue"
import { createI18n } from "vue-i18n"
import type { Component } from "vue"
import en from "../../../../../../locales/en.json"
import SchemaFieldsTable from "../SchemaFieldsTable.vue"
import RequestBody from "../RequestBody.vue"

// Toasts need the toasted plugin, which these DOM-only tests don't install
vi.mock("~/composables/toast", () => ({
  useToast: () => ({ success: () => {}, error: () => {} }),
}))

const i18n = createI18n({
  legacy: false,
  locale: "en",
  fallbackLocale: "en",
  messages: { en },
})

/**
 * Mount a component in jsdom using plain Vue APIs (the repo doesn't ship
 * @vue/test-utils) and register the auto-imported sibling component that the
 * SFC references by its unplugin-vue-components name.
 */
const mountComponent = (
  component: Component,
  props: Record<string, unknown>
) => {
  const el = document.createElement("div")
  document.body.appendChild(el)

  const app = createApp({ render: () => h(component, props) })
  app.use(i18n)
  app.component(
    "CollectionsDocumentationSectionsSchemaFieldsTable",
    SchemaFieldsTable
  )
  app.mount(el)

  return el
}

const FIELDS = [
  { name: "username", type: "string", required: true, description: "登录名" },
  {
    name: "age",
    type: "integer<int32>",
    required: false,
    description: "年龄",
  },
]

const NESTED_FIELDS = [
  {
    name: "list",
    type: "array<object>",
    required: false,
    description: "当前页用户列表",
    children: [
      {
        name: "id",
        type: "string",
        required: true,
        description: "用户 ID",
      },
      {
        name: "profile",
        type: "object",
        required: false,
        description: "扩展资料",
        children: [
          {
            name: "nickname",
            type: "string",
            required: false,
            description: "昵称",
          },
        ],
      },
    ],
  },
]

describe("SchemaFieldsTable", () => {
  it("renders an Apifox-style field table", () => {
    const el = mountComponent(SchemaFieldsTable, {
      fields: FIELDS,
      title: "Schema Fields",
    })

    const text = el.textContent ?? ""

    // Column headers
    expect(text).toContain("Field")
    expect(text).toContain("Type")
    expect(text).toContain("Required")
    expect(text).toContain("Description")

    // Row content
    expect(text).toContain("username")
    expect(text).toContain("integer<int32>")
    expect(text).toContain("登录名")
    expect(text).toContain("年龄")

    // Required badge differs per row
    const badges = [
      ...el.querySelectorAll("tbody tr td:nth-child(3) span"),
    ].map((n) => n.textContent?.trim())
    expect(badges).toEqual(["Yes", "No"])
  })

  it("renders nested fields as a tree and toggles them", async () => {
    const fields = NESTED_FIELDS

    const el = mountComponent(SchemaFieldsTable, { fields })

    // Expanded by default: every level is visible
    let text = el.textContent ?? ""
    expect(text).toContain("list")
    expect(text).toContain("当前页用户列表")
    expect(text).toContain("用户 ID")
    expect(text).toContain("昵称")

    // Indentation encodes nesting depth
    const nameCells = [
      ...el.querySelectorAll("tbody tr td:first-child"),
    ] as HTMLElement[]
    const paddingOf = (index: number) =>
      Number(nameCells[index].style.paddingLeft.replace("px", ""))
    expect(paddingOf(1)).toBeGreaterThan(paddingOf(0))
    // rows: list(0) → id(1) / profile(1) → nickname(2)
    expect(paddingOf(3)).toBeGreaterThan(paddingOf(1))

    // Collapsing the root hides the whole subtree
    const toggle = el.querySelector("tbody tr button") as HTMLButtonElement
    expect(toggle).not.toBeNull()
    toggle.click()
    await nextTick()

    text = el.textContent ?? ""
    expect(text).toContain("当前页用户列表")
    expect(text).not.toContain("用户 ID")
    expect(text).not.toContain("昵称")
  })

  it("copies the whole tree as a Markdown table", async () => {
    const written: string[] = []
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (text: string) => {
          written.push(text)
          return Promise.resolve()
        },
      },
    })

    const el = mountComponent(SchemaFieldsTable, {
      fields: NESTED_FIELDS,
      title: "Schema Fields",
    })

    const copyButton = [...el.querySelectorAll("button")].find((button) =>
      (button.textContent ?? "").includes("Copy docs")
    ) as HTMLButtonElement
    expect(copyButton).toBeTruthy()

    copyButton.click()
    await nextTick()
    await Promise.resolve()

    const md = written[0] ?? ""
    expect(md).toContain("### Schema Fields")
    expect(md).toContain("| Field | Type | Required | Description |")
    expect(md).toContain("| list | array<object> | No | 当前页用户列表 |")
    // Nested names use path notation
    expect(md).toContain("| list[].id | string | Yes | 用户 ID |")
    expect(md).toContain("| list[].profile | object | No | 扩展资料 |")
    expect(md).toContain("| list[].profile.nickname | string | No | 昵称 |")

    // Collapsed rows are still exported — this is a doc snapshot, not a view dump
    const collapseToggle = el.querySelector(
      "tbody tr button"
    ) as HTMLButtonElement
    collapseToggle.click()
    await nextTick()

    copyButton.click()
    await nextTick()
    await Promise.resolve()

    expect(written[1]).toContain("| list[].profile.nickname |")

    // Leave the environment clean for the remaining tests
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    })
  })

  it("renders nothing when there are no fields", () => {
    const el = mountComponent(SchemaFieldsTable, { fields: [] })
    expect(el.innerHTML.trim()).toBe("<!--v-if-->")
  })
})

describe("RequestBody documentation section", () => {
  it("shows the requestBody description and schema field table", () => {
    const el = mountComponent(RequestBody, {
      body: { contentType: "application/json", body: '{"username":"admin"}' },
      apiSpecMeta: {
        requestBodyDescription: "New user payload",
        bodySchemaFields: FIELDS,
        responseSchemaFields: {},
      },
    })

    const text = el.textContent ?? ""

    expect(text).toContain("New user payload")
    expect(text).toContain("application/json")
    // Body preview still rendered
    expect(text).toContain('"username": "admin"')
    // Field table pulled from apiSpecMeta
    expect(text).toContain("登录名")
    expect(text).toContain("integer<int32>")
  })

  it("omits the description block and field table for plain requests", () => {
    const el = mountComponent(RequestBody, {
      body: { contentType: "application/json", body: "{}" },
    })

    const text = el.textContent ?? ""
    expect(text).not.toContain("Field")
    expect(text).not.toContain("Required")
  })
})
