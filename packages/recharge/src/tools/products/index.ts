import { tool } from "ai";
import { z } from "zod";
import { rechargeRequest } from "../../client/http";

const accountField = z.string().describe("Recharge account name as defined in workbench.config.ts (e.g. recharge-seed-staging)");

const variantSchema = z.object({
  external_variant_id: z.object({ ecommerce: z.string() }),
  title: z.string(),
  price: z.string().optional(),
  sku: z.string().optional(),
  image: z.object({ original: z.string() }).optional(),
});

const optionSchema = z.object({
  name: z.string(),
  values: z.array(z.string()),
});

const imageSchema = z.object({
  original: z.string(),
  large: z.string().optional(),
  medium: z.string().optional(),
  small: z.string().optional(),
});

export const productTools = {
  recharge_2021_11_products_create: tool({
    description: "Create a product in Recharge.",
    parameters: z.object({
      account: accountField,
      external_product_id: z.object({ ecommerce: z.string() }),
      title: z.string(),
      vendor: z.string(),
      options: z.array(optionSchema),
      variants: z.array(variantSchema),
      brand: z.string().optional(),
      images: z.array(imageSchema).optional(),
      published_at: z.string().optional(),
      requires_shipping: z.boolean().optional(),
    }),
    execute: async ({ account, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: "/products", body });
      return res.data;
    },
  }),

  recharge_2021_11_products_get: tool({
    description: "Retrieve a single product by its external product ID.",
    parameters: z.object({
      account: accountField,
      external_product_id: z.string().describe("External product ID (ecommerce platform ID)"),
    }),
    execute: async ({ account, external_product_id }) => {
      const res = await rechargeRequest({ account, method: "GET", path: `/products/${external_product_id}` });
      return res.data;
    },
  }),

  recharge_2021_11_products_update: tool({
    description: "Update an existing product.",
    parameters: z.object({
      account: accountField,
      external_product_id: z.string().describe("External product ID"),
      title: z.string().optional(),
      vendor: z.string().optional(),
      options: z.array(optionSchema).optional(),
      variants: z.array(variantSchema).optional(),
      brand: z.string().optional(),
      images: z.array(imageSchema).optional(),
      published_at: z.string().optional(),
      requires_shipping: z.boolean().optional(),
    }),
    execute: async ({ account, external_product_id, ...body }) => {
      const res = await rechargeRequest({ account, method: "PUT", path: `/products/${external_product_id}`, body });
      return res.data;
    },
  }),

  recharge_2021_11_products_delete: tool({
    description: "Delete a product by its external product ID.",
    parameters: z.object({
      account: accountField,
      external_product_id: z.string().describe("External product ID"),
    }),
    execute: async ({ account, external_product_id }) => {
      const res = await rechargeRequest({ account, method: "DELETE", path: `/products/${external_product_id}` });
      return res.data;
    },
  }),

  recharge_2021_11_products_list: tool({
    description: "List products with optional filters.",
    parameters: z.object({
      account: accountField,
      external_product_ids: z.string().optional().describe("Comma-separated external product IDs"),
    }),
    execute: async ({ account, ...query }) => {
      const res = await rechargeRequest({
        account,
        method: "GET",
        path: "/products",
        query: query as Record<string, string | number | boolean | undefined>,
      });
      return res.data;
    },
  }),
};
