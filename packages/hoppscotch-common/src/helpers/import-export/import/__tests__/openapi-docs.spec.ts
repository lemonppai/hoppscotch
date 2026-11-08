import { beforeAll, describe, expect, it } from "vitest"
import * as E from "fp-ts/Either"

type ConvertFn = (typeof import("../openapi"))["convertOpenApiDocsToHopp"]

let convertOpenApiDocsToHopp: ConvertFn

beforeAll(async () => {
  // The importer module instantiates its validation worker at import time.
  // jsdom has no Worker implementation, so stub it before the dynamic import.
  if (typeof (globalThis as any).Worker === "undefined") {
    ;(globalThis as any).Worker = class {
      constructor() {}
      postMessage() {}
      terminate() {}
      addEventListener() {}
      removeEventListener() {}
    }
  }

  const mod = await import("../openapi")
  convertOpenApiDocsToHopp = mod.convertOpenApiDocsToHopp
})

type AnyCollection = {
  name: string
  requests: any[]
  folders: AnyCollection[]
}

const flattenRequests = (collections: AnyCollection[]): any[] => {
  const out: any[] = []
  const walk = (c: AnyCollection) => {
    out.push(...c.requests)
    c.folders.forEach(walk)
  }
  collections.forEach(walk)
  return out
}

const convert = async (doc: unknown): Promise<any[]> => {
  const result = await convertOpenApiDocsToHopp([doc as any])()
  if (E.isLeft(result)) throw new Error(result.left)
  return flattenRequests(result.right as AnyCollection[])
}

const V3_DOC = {
  openapi: "3.0.3",
  info: { title: "User API", version: "1.0.0" },
  servers: [{ url: "https://api.example.com" }],
  tags: [{ name: "Users", description: "User operations" }],
  paths: {
    "/users": {
      post: {
        summary: "Create user",
        description: "Create a new user account",
        tags: ["Users"],
        parameters: [
          {
            name: "X-Trace-Id",
            in: "header",
            description: "Trace id",
            schema: { type: "string" },
          },
          {
            name: "verbose",
            in: "query",
            description: "Verbose output",
            schema: { type: "boolean" },
          },
        ],
        requestBody: {
          description: "New user payload",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["username"],
                properties: {
                  username: { type: "string", description: "登录名" },
                  age: {
                    type: "integer",
                    format: "int32",
                    description: "年龄",
                  },
                  roles: {
                    type: "array",
                    items: { type: "string" },
                    description: "角色列表",
                  },
                  profile: { type: "object", description: "扩展信息" },
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Successful response",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["id"],
                  properties: {
                    id: {
                      type: "integer",
                      format: "int64",
                      description: "User ID",
                    },
                    username: { type: "string", description: "登录名" },
                  },
                },
              },
            },
          },
          "404": {
            description: "Not found",
          },
        },
      },
    },
  },
}

const V2_DOC = {
  swagger: "2.0",
  info: { title: "Legacy API", version: "1.0.0" },
  host: "api.example.com",
  basePath: "/v2",
  schemes: ["https"],
  paths: {
    "/orders": {
      post: {
        summary: "Create order",
        consumes: ["application/json"],
        parameters: [
          {
            name: "body",
            in: "body",
            description: "Order payload",
            schema: {
              type: "object",
              required: ["amount"],
              properties: {
                amount: { type: "number", description: "金额" },
                remark: { type: "string", description: "备注" },
              },
            },
          },
        ],
        responses: {
          "201": {
            description: "Created response",
            schema: {
              type: "object",
              properties: {
                orderId: { type: "string", description: "订单号" },
              },
            },
          },
        },
      },
    },
  },
}

describe("OpenAPI v3 documentation metadata import", () => {
  it("preserves request/param descriptions and extracts schema field tables", async () => {
    const [request] = await convert(V3_DOC)

    expect(request).toBeDefined()
    expect(request.name).toBe("Create user")
    expect(request.description).toBe("Create a new user account")

    // Query / header descriptions (pre-existing behaviour must not regress)
    expect(request.params[0]).toMatchObject({
      key: "verbose",
      description: "Verbose output",
    })
    expect(
      request.headers.find((h: any) => h.key === "X-Trace-Id").description
    ).toBe("Trace id")

    // requestBody description + schema fields
    expect(request.apiSpecMeta.requestBodyDescription).toBe("New user payload")

    const bodyFields = request.apiSpecMeta.bodySchemaFields
    expect(bodyFields).toHaveLength(4)
    expect(bodyFields[0]).toMatchObject({
      name: "username",
      type: "string",
      required: true,
      description: "登录名",
    })
    expect(bodyFields[1]).toMatchObject({
      name: "age",
      type: "integer<int32>",
      required: false,
      description: "年龄",
    })
    expect(bodyFields[2]).toMatchObject({
      name: "roles",
      type: "array<string>",
      description: "角色列表",
    })
    expect(bodyFields[3]).toMatchObject({ name: "profile", type: "object" })

    // Response field tables live on the response objects themselves
    expect(Object.keys(request.responses)).toContain("Successful response")

    const resFields = request.responses["Successful response"].schemaFields
    expect(resFields).toHaveLength(2)
    expect(resFields[0]).toMatchObject({
      name: "id",
      type: "integer<int64>",
      required: true,
      description: "User ID",
    })
    // Response without a schema contributes no field table
    expect(request.responses["Not found"].schemaFields).toEqual([])
  })
})

describe("OpenAPI v2 documentation metadata import", () => {
  it("reads body description and schema fields from the body parameter", async () => {
    const [request] = await convert(V2_DOC)

    expect(request).toBeDefined()
    expect(request.apiSpecMeta.requestBodyDescription).toBe("Order payload")

    const bodyFields = request.apiSpecMeta.bodySchemaFields
    expect(bodyFields).toHaveLength(2)
    expect(bodyFields[0]).toMatchObject({
      name: "amount",
      type: "number",
      required: true,
      description: "金额",
    })
    expect(bodyFields[1]).toMatchObject({
      name: "remark",
      type: "string",
      description: "备注",
    })

    const resFields = request.responses["Created response"].schemaFields
    expect(resFields).toHaveLength(1)
    expect(resFields[0]).toMatchObject({
      name: "orderId",
      type: "string",
      description: "订单号",
    })
  })
})

const V2_FORM_DOC = {
  swagger: "2.0",
  info: { title: "Auth API", version: "1.0.0" },
  host: "api.example.com",
  basePath: "/v2",
  schemes: ["https"],
  paths: {
    "/auth/token": {
      post: {
        summary: "Issue token",
        consumes: ["application/x-www-form-urlencoded"],
        parameters: [
          {
            name: "clientId",
            in: "formData",
            required: true,
            type: "string",
            description: "应用 ID",
          },
          {
            name: "clientSecret",
            in: "formData",
            type: "string",
            format: "password",
            description: "应用密钥",
          },
        ],
        responses: {
          "200": { description: "Issued" },
        },
      },
    },
  },
}

describe("OpenAPI v2 formData parameters", () => {
  it("maps formData parameters onto schema field rows", async () => {
    const [request] = await convert(V2_FORM_DOC)

    expect(request.body.contentType).toBe("application/x-www-form-urlencoded")
    // v2 has no requestBody object, so there is no body level description
    expect(request.apiSpecMeta.requestBodyDescription).toBe("")

    const bodyFields = request.apiSpecMeta.bodySchemaFields
    expect(bodyFields).toHaveLength(2)
    expect(bodyFields[0]).toMatchObject({
      name: "clientId",
      type: "string",
      required: true,
      description: "应用 ID",
    })
    expect(bodyFields[1]).toMatchObject({
      name: "clientSecret",
      type: "string<password>",
      required: false,
      description: "应用密钥",
    })
  })
})

const V3_PATH_LEVEL_PARAMS_DOC = {
  openapi: "3.0.3",
  info: { title: "Tenant API", version: "1.0.0" },
  paths: {
    "/users/{userId}": {
      parameters: [
        {
          name: "userId",
          in: "path",
          required: true,
          description: "用户 ID",
          schema: { type: "string" },
        },
        {
          name: "X-Tenant",
          in: "header",
          description: "租户标识",
          schema: { type: "string" },
        },
        {
          name: "verbose",
          in: "query",
          description: "详细输出",
          schema: { type: "boolean" },
        },
      ],
      get: {
        summary: "Get user",
        responses: { "200": { description: "OK" } },
      },
      put: {
        summary: "Replace user",
        parameters: [
          {
            name: "X-Tenant",
            in: "header",
            description: "覆盖后的租户标识",
            schema: { type: "string" },
          },
        ],
        responses: { "200": { description: "OK" } },
      },
    },
  },
}

describe("OpenAPI path item level parameters", () => {
  it("inherits path level parameters and lets operations override them", async () => {
    const [getReq, putReq] = await convert(V3_PATH_LEVEL_PARAMS_DOC)

    // Inherited from the path item
    expect(getReq.requestVariables.map((v: any) => v.key)).toContain("userId")
    expect(getReq.params[0]).toMatchObject({
      key: "verbose",
      description: "详细输出",
    })
    expect(
      getReq.headers.find((h: any) => h.key === "X-Tenant").description
    ).toBe("租户标识")

    // Operation level entry wins over the inherited one, without duplication
    const putTenantHeaders = putReq.headers.filter(
      (h: any) => h.key === "X-Tenant"
    )
    expect(putTenantHeaders).toHaveLength(1)
    expect(putTenantHeaders[0].description).toBe("覆盖后的租户标识")
  })
})

const V3_NESTED_DOC = {
  openapi: "3.0.3",
  info: { title: "Nested API", version: "1.0.0" },
  servers: [{ url: "https://api.example.com" }],
  paths: {
    "/users": {
      post: {
        summary: "Create user",
        requestBody: {
          description: "创建用户的请求体",
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["profile"],
                properties: {
                  profile: {
                    type: "object",
                    description: "扩展资料",
                    required: ["nickname"],
                    properties: {
                      nickname: { type: "string", description: "昵称" },
                      avatar: { type: "string", format: "uri" },
                    },
                  },
                  tags: {
                    type: "array",
                    description: "标签",
                    items: {
                      type: "object",
                      properties: {
                        id: { type: "integer", description: "标签 ID" },
                        label: { type: "string" },
                      },
                    },
                  },
                  roleIds: {
                    type: "array",
                    items: { type: "integer", format: "int64" },
                  },
                },
              },
            },
          },
        },
        responses: { "200": { description: "OK" } },
      },
      get: {
        summary: "List users",
        responses: {
          "200": {
            description: "查询成功",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    total: { type: "integer" },
                    list: {
                      type: "array",
                      description: "当前页用户列表",
                      items: {
                        type: "object",
                        properties: {
                          id: { type: "string", description: "用户 ID" },
                          profile: {
                            type: "object",
                            description: "扩展资料",
                            properties: {
                              nickname: {
                                type: "string",
                                description: "昵称",
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

const fieldNames = (fields: any[]): string[] => fields.map((f) => f.name)

describe("OpenAPI nested schema fields", () => {
  it("expands nested objects and array item objects into a tree", async () => {
    // Method order inside a path item is get/head/post/... — GET comes first
    const [getReq, postReq] = await convert(V3_NESTED_DOC)

    const bodyFields = postReq.apiSpecMeta.bodySchemaFields
    expect(fieldNames(bodyFields)).toEqual(["profile", "tags", "roleIds"])

    const profile = bodyFields.find((f: any) => f.name === "profile")
    expect(profile.required).toBe(true)
    expect(profile.description).toBe("扩展资料")
    expect(fieldNames(profile.children)).toEqual(["nickname", "avatar"])
    expect(profile.children[0]).toMatchObject({
      name: "nickname",
      required: true,
      description: "昵称",
    })
    // Format is reflected on the type label, missing description stays empty
    expect(profile.children[1]).toMatchObject({
      type: "string<uri>",
      description: "",
    })

    // Array of objects: children come from `items.properties`
    const tags = bodyFields.find((f: any) => f.name === "tags")
    expect(tags.type).toBe("array<object>")
    expect(tags.description).toBe("标签")
    expect(fieldNames(tags.children)).toEqual(["id", "label"])

    // Array of primitives has no children
    const roleIds = bodyFields.find((f: any) => f.name === "roleIds")
    expect(roleIds.type).toBe("array<integer<int64>>")
    expect(roleIds.children).toBeUndefined()

    // Response tree: two levels deep
    const listField = getReq.responses["查询成功"].schemaFields.find(
      (f: any) => f.name === "list"
    )
    expect(fieldNames(listField.children)).toEqual(["id", "profile"])
    const nestedProfile = listField.children.find(
      (f: any) => f.name === "profile"
    )
    expect(fieldNames(nestedProfile.children)).toEqual(["nickname"])
  })

  it("merges allOf members and stops on self-referencing schemas", async () => {
    const recursive: any = {
      type: "object",
      properties: {
        name: { type: "string", description: "节点名" },
      },
    }
    recursive.properties.child = recursive

    const doc = {
      openapi: "3.0.3",
      info: { title: "Recursive API", version: "1.0.0" },
      servers: [{ url: "https://api.example.com" }],
      paths: {
        "/nodes": {
          post: {
            summary: "Create node",
            requestBody: {
              content: {
                "application/json": {
                  schema: {
                    allOf: [
                      { type: "object", properties: { a: { type: "string" } } },
                      {
                        type: "object",
                        required: ["b"],
                        properties: { b: { type: "integer" } },
                      },
                      recursive,
                    ],
                  },
                },
              },
            },
            responses: { "200": { description: "OK" } },
          },
        },
      },
    }

    const [req] = await convert(doc)
    const fields = req.apiSpecMeta.bodySchemaFields
    expect(fieldNames(fields)).toEqual(["a", "b", "name", "child"])

    const b = fields.find((f: any) => f.name === "b")
    expect(b.required).toBe(true)

    // The cycle is cut after one repetition instead of recursing forever
    const child = fields.find((f: any) => f.name === "child")
    expect(fieldNames(child.children)).toEqual(["name", "child"])
    expect(child.children[1].children).toBeUndefined()
  })
})
