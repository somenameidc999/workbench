import { join } from "path";

export type IntrospectionSchema = {
  __schema: {
    queryType: { name: string } | null;
    mutationType: { name: string } | null;
    subscriptionType: { name: string } | null;
    types: Array<{
      kind: string;
      name: string;
      description: string | null;
      fields: Array<{
        name: string;
        description: string | null;
        args: unknown[];
        type: unknown;
        isDeprecated: boolean;
        deprecationReason: string | null;
      }> | null;
      inputFields: unknown[] | null;
      interfaces: unknown[] | null;
      enumValues: unknown[] | null;
      possibleTypes: unknown[] | null;
    }>;
  };
};

let cached: IntrospectionSchema | null = null;

export async function loadSchema(): Promise<IntrospectionSchema> {
  if (cached) return cached;

  const version = process.env.SHOPIFY_API_VERSION ?? "2024-01";
  const filePath = join(import.meta.dir, `admin-${version}.json`);
  const file = Bun.file(filePath);

  if (!(await file.exists())) {
    throw new Error(
      `Schema file not found at ${filePath}. Run: bun run fetch-schema`,
    );
  }

  cached = (await file.json()) as IntrospectionSchema;
  return cached;
}

/** Reset cached schema (for testing). */
export function resetSchemaCache(): void {
  cached = null;
}
