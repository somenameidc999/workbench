import { join } from "path";

const INTROSPECTION_QUERY = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      subscriptionType { name }
      types {
        ...FullType
      }
    }
  }

  fragment FullType on __Type {
    kind
    name
    description
    fields(includeDeprecated: true) {
      name
      description
      args {
        ...InputValue
      }
      type {
        ...TypeRef
      }
      isDeprecated
      deprecationReason
    }
    inputFields {
      ...InputValue
    }
    interfaces {
      ...TypeRef
    }
    enumValues(includeDeprecated: true) {
      name
      description
      isDeprecated
      deprecationReason
    }
    possibleTypes {
      ...TypeRef
    }
  }

  fragment InputValue on __InputValue {
    name
    description
    type { ...TypeRef }
    defaultValue
  }

  fragment TypeRef on __Type {
    kind
    name
    ofType {
      kind
      name
      ofType {
        kind
        name
        ofType {
          kind
          name
          ofType {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

const shop = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ACCESS_TOKEN;
const version = process.env.SHOPIFY_API_VERSION ?? "2024-01";

if (!shop || !token) {
  console.error("Required env vars: SHOPIFY_STORE_DOMAIN, SHOPIFY_ACCESS_TOKEN");
  console.error("Example: SHOPIFY_STORE_DOMAIN=my-store.myshopify.com SHOPIFY_ACCESS_TOKEN=shpat_xxx bun scripts/fetch-schema.ts");
  process.exit(1);
}

const host = shop.replace(/^https?:\/\//, "").replace(/\/$/, "");
const url = `https://${host}/admin/api/${version}/graphql.json`;

console.log(`Fetching introspection schema from ${url} ...`);

const res = await fetch(url, {
  method: "POST",
  headers: {
    "X-Shopify-Access-Token": token,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ query: INTROSPECTION_QUERY }),
});

if (!res.ok) {
  const text = await res.text();
  console.error(`Shopify responded ${res.status}: ${text.slice(0, 500)}`);
  process.exit(1);
}

const json = await res.json() as { data?: unknown; errors?: Array<{ message: string }> };

if (json.errors?.length) {
  console.error("GraphQL errors:", json.errors.map((e) => e.message).join("; "));
  process.exit(1);
}

const outPath = join(import.meta.dir, "..", "src", "schema", `admin-${version}.json`);
await Bun.write(outPath, JSON.stringify(json.data, null, 2));

console.log(`Schema written to ${outPath} (${(await Bun.file(outPath).size / 1024 / 1024).toFixed(1)} MB)`);
