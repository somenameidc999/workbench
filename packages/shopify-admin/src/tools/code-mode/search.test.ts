import { test, expect, describe, beforeEach, mock } from "bun:test";
import { handleSearch } from "./search.tool";

const MOCK_SCHEMA = {
  __schema: {
    queryType: { name: "QueryRoot" },
    mutationType: { name: "Mutation" },
    subscriptionType: null,
    types: [
      {
        kind: "OBJECT",
        name: "QueryRoot",
        description: "The query root.",
        fields: [
          { name: "order", description: "Find an order by ID", args: [], type: { kind: "OBJECT", name: "Order" }, isDeprecated: false, deprecationReason: null },
          { name: "product", description: "Find a product by ID", args: [], type: { kind: "OBJECT", name: "Product" }, isDeprecated: false, deprecationReason: null },
        ],
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: "OBJECT",
        name: "Order",
        description: "An order.",
        fields: [
          { name: "id", description: "The ID", args: [], type: { kind: "SCALAR", name: "ID" }, isDeprecated: false, deprecationReason: null },
          { name: "name", description: "The name", args: [], type: { kind: "SCALAR", name: "String" }, isDeprecated: false, deprecationReason: null },
        ],
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: "OBJECT",
        name: "Product",
        description: "A product.",
        fields: [
          { name: "id", description: "The ID", args: [], type: { kind: "SCALAR", name: "ID" }, isDeprecated: false, deprecationReason: null },
          { name: "title", description: "The title", args: [], type: { kind: "SCALAR", name: "String" }, isDeprecated: false, deprecationReason: null },
        ],
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
      {
        kind: "OBJECT",
        name: "Mutation",
        description: "The mutation root.",
        fields: [
          { name: "orderUpdate", description: "Update an order", args: [], type: { kind: "OBJECT", name: "Order" }, isDeprecated: false, deprecationReason: null },
        ],
        inputFields: null,
        interfaces: null,
        enumValues: null,
        possibleTypes: null,
      },
    ],
  },
};

// Mock loadSchema to return our test schema
mock.module("../../schema/load-schema.js", () => ({
  loadSchema: async () => MOCK_SCHEMA,
}));

describe("search tool", () => {
  test("filters types by name", async () => {
    const result = await handleSearch({
      code: `return schema.__schema.types.filter(t => t.name.includes("Order")).map(t => t.name);`,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("success");
    expect(parsed.result).toEqual(["Order"]);
  });

  test("lists all mutations", async () => {
    const result = await handleSearch({
      code: `
        const m = schema.__schema.types.find(t => t.name === schema.__schema.mutationType.name);
        return m.fields.map(f => f.name);
      `,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("success");
    expect(parsed.result).toEqual(["orderUpdate"]);
  });

  test("gets fields of a type", async () => {
    const result = await handleSearch({
      code: `
        const t = schema.__schema.types.find(t => t.name === "Product");
        return t.fields.map(f => f.name);
      `,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("success");
    expect(parsed.result).toEqual(["id", "title"]);
  });

  test("returns error for invalid code", async () => {
    const result = await handleSearch({ code: "throw new Error('test failure');" });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("error");
    expect(parsed.error).toBe("test failure");
    expect(result.isError).toBe(true);
  });

  test("captures logs", async () => {
    const result = await handleSearch({
      code: `console.log("searching..."); return schema.__schema.queryType.name;`,
    });
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.status).toBe("success");
    expect(parsed.result).toBe("QueryRoot");
    expect(parsed.logs).toEqual(["searching..."]);
  });
});
