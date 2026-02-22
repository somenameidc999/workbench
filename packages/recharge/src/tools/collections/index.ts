import { tool } from "ai";
import { z } from "zod";
import { rechargeRequest } from "../../client/http";

const accountField = z.string().describe("Recharge account name as defined in workbench.config.ts (e.g. recharge-seed-staging)");

const collectionProductSchema = z.object({
  external_product_id: z.object({ ecommerce: z.string() }),
});

export const collectionTools = {
  recharge_2021_11_collections_create: tool({
    description: "Create a new collection.",
    parameters: z.object({
      account: accountField,
      title: z.string(),
      description: z.string(),
      sort_order: z.enum(["alpha-asc", "alpha-desc", "created-asc", "created-desc", "manual", "best-selling", "price-asc", "price-desc"]).optional(),
    }),
    execute: async ({ account, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: "/collections", body });
      return res.data;
    },
  }),

  recharge_2021_11_collections_get: tool({
    description: "Retrieve a single collection by ID.",
    parameters: z.object({
      account: accountField,
      collection_id: z.number().describe("Collection ID"),
    }),
    execute: async ({ account, collection_id }) => {
      const res = await rechargeRequest({ account, method: "GET", path: `/collections/${collection_id}` });
      return res.data;
    },
  }),

  recharge_2021_11_collections_update: tool({
    description: "Update an existing collection.",
    parameters: z.object({
      account: accountField,
      collection_id: z.number().describe("Collection ID"),
      title: z.string().optional(),
      description: z.string().optional(),
      sort_order: z.enum(["alpha-asc", "alpha-desc", "created-asc", "created-desc", "manual", "best-selling", "price-asc", "price-desc"]).optional(),
    }),
    execute: async ({ account, collection_id, ...body }) => {
      const res = await rechargeRequest({ account, method: "PUT", path: `/collections/${collection_id}`, body });
      return res.data;
    },
  }),

  recharge_2021_11_collections_delete: tool({
    description: "Delete a collection by ID.",
    parameters: z.object({
      account: accountField,
      collection_id: z.number().describe("Collection ID"),
    }),
    execute: async ({ account, collection_id }) => {
      const res = await rechargeRequest({ account, method: "DELETE", path: `/collections/${collection_id}` });
      return res.data;
    },
  }),

  recharge_2021_11_collections_list: tool({
    description: "List collections with optional filters.",
    parameters: z.object({
      account: accountField,
      title: z.string().optional(),
    }),
    execute: async ({ account, ...query }) => {
      const res = await rechargeRequest({
        account,
        method: "GET",
        path: "/collections",
        query: query as Record<string, string | number | boolean | undefined>,
      });
      return res.data;
    },
  }),

  recharge_2021_11_collections_list_products: tool({
    description: "List products in a collection (or all collection products).",
    parameters: z.object({
      account: accountField,
      collection_id: z.number().optional().describe("Collection ID (omit to list all)"),
    }),
    execute: async ({ account, collection_id }) => {
      const path = collection_id
        ? `/collections/${collection_id}/products`
        : "/collection_products";
      const res = await rechargeRequest({ account, method: "GET", path });
      return res.data;
    },
  }),

  recharge_2021_11_collections_add_products: tool({
    description: "Add products to a collection.",
    parameters: z.object({
      account: accountField,
      collection_id: z.number().describe("Collection ID"),
      collection_products: z.array(collectionProductSchema).describe("Products to add"),
    }),
    execute: async ({ account, collection_id, ...body }) => {
      const res = await rechargeRequest({
        account,
        method: "POST",
        path: `/collections/${collection_id}/products`,
        body,
      });
      return res.data;
    },
  }),

  recharge_2021_11_collections_remove_products: tool({
    description: "Remove products from a collection.",
    parameters: z.object({
      account: accountField,
      collection_id: z.number().describe("Collection ID"),
      collection_products: z.array(collectionProductSchema).describe("Products to remove"),
    }),
    execute: async ({ account, collection_id, ...body }) => {
      const res = await rechargeRequest({
        account,
        method: "DELETE",
        path: `/collections/${collection_id}/products`,
        body,
      });
      return res.data;
    },
  }),
};
