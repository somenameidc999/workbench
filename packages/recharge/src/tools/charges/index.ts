import { tool } from "ai";
import { z } from "zod";
import { rechargeRequest } from "../../client/http";

const accountField = z.string().describe("Recharge account name as defined in workbench.config.ts (e.g. recharge-seed-staging)");

export const chargeTools = {
  recharge_2021_11_charges_get: tool({
    description: "Retrieve a single charge by ID.",
    parameters: z.object({
      account: accountField,
      charge_id: z.number().describe("Charge ID"),
    }),
    execute: async ({ account, charge_id }) => {
      const res = await rechargeRequest({ account, method: "GET", path: `/charges/${charge_id}` });
      return res.data;
    },
  }),

  recharge_2021_11_charges_list: tool({
    description: "List charges with optional filters.",
    parameters: z.object({
      account: accountField,
      address_id: z.number().optional(),
      customer_id: z.number().optional(),
      discount_code: z.string().optional(),
      discount_id: z.number().optional(),
      external_order_id: z.string().optional(),
      ids: z.string().optional().describe("Comma-separated charge IDs"),
      purchase_item_id: z.number().optional(),
      purchase_item_ids: z.string().optional().describe("Comma-separated purchase item IDs"),
      status: z.enum(["queued", "skipped", "error", "refunded", "partially_refunded", "success"]).optional(),
      limit: z.number().optional().describe("Max results (default 50, max 250)"),
      sort_by: z.string().optional().describe("Sort field (e.g. scheduled_at asc)"),
      created_at_min: z.string().optional(),
      created_at_max: z.string().optional(),
      scheduled_at_min: z.string().optional(),
      scheduled_at_max: z.string().optional(),
      updated_at_min: z.string().optional(),
      updated_at_max: z.string().optional(),
      processed_at_min: z.string().optional(),
      processed_at_max: z.string().optional(),
    }),
    execute: async ({ account, ...query }) => {
      const res = await rechargeRequest({
        account,
        method: "GET",
        path: "/charges",
        query: query as Record<string, string | number | boolean | undefined>,
      });
      return res.data;
    },
  }),

  recharge_2021_11_charges_apply_discount: tool({
    description: "Apply a discount to a charge.",
    parameters: z.object({
      account: accountField,
      charge_id: z.number().describe("Charge ID"),
      discount_code: z.string().optional(),
      discount_id: z.number().optional(),
    }),
    execute: async ({ account, charge_id, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: `/charges/${charge_id}/apply_discount`, body });
      return res.data;
    },
  }),

  recharge_2021_11_charges_remove_discount: tool({
    description: "Remove a discount from a charge.",
    parameters: z.object({
      account: accountField,
      charge_id: z.number().describe("Charge ID"),
    }),
    execute: async ({ account, charge_id }) => {
      const res = await rechargeRequest({ account, method: "POST", path: `/charges/${charge_id}/remove_discount` });
      return res.data;
    },
  }),

  recharge_2021_11_charges_skip: tool({
    description: "Skip a queued charge for specific purchase items.",
    parameters: z.object({
      account: accountField,
      charge_id: z.number().describe("Charge ID"),
      purchase_item_ids: z.array(z.number()).describe("Purchase item IDs to skip"),
    }),
    execute: async ({ account, charge_id, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: `/charges/${charge_id}/skip`, body });
      return res.data;
    },
  }),

  recharge_2021_11_charges_unskip: tool({
    description: "Unskip a previously skipped charge.",
    parameters: z.object({
      account: accountField,
      charge_id: z.number().describe("Charge ID"),
      purchase_item_ids: z.array(z.number()).describe("Purchase item IDs to unskip"),
    }),
    execute: async ({ account, charge_id, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: `/charges/${charge_id}/unskip`, body });
      return res.data;
    },
  }),

  recharge_2021_11_charges_refund: tool({
    description: "Refund a charge (full or partial).",
    parameters: z.object({
      account: accountField,
      charge_id: z.number().describe("Charge ID"),
      amount: z.string().describe("Amount to refund"),
      full_refund: z.boolean().optional(),
      retry: z.boolean().optional(),
      error: z.string().optional(),
      error_type: z.string().optional(),
    }),
    execute: async ({ account, charge_id, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: `/charges/${charge_id}/refund`, body });
      return res.data;
    },
  }),

  recharge_2021_11_charges_process: tool({
    description: "Process a queued charge immediately.",
    parameters: z.object({
      account: accountField,
      charge_id: z.number().describe("Charge ID"),
    }),
    execute: async ({ account, charge_id }) => {
      const res = await rechargeRequest({ account, method: "POST", path: `/charges/${charge_id}/process` });
      return res.data;
    },
  }),

  recharge_2021_11_charges_capture: tool({
    description: "Capture a previously authorized charge.",
    parameters: z.object({
      account: accountField,
      charge_id: z.number().describe("Charge ID"),
    }),
    execute: async ({ account, charge_id }) => {
      const res = await rechargeRequest({ account, method: "POST", path: `/charges/${charge_id}/capture_payment` });
      return res.data;
    },
  }),

  recharge_2021_11_charges_add_free_gift: tool({
    description: "Add free gift items to a charge.",
    parameters: z.object({
      account: accountField,
      charge_id: z.number().describe("Charge ID"),
      free_gifts: z.array(z.object({
        external_variant_id: z.string(),
        quantity: z.number().int().positive(),
      })),
      conserve_on_skip: z.boolean().optional(),
    }),
    execute: async ({ account, charge_id, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: `/charges/${charge_id}/add_free_gift`, body });
      return res.data;
    },
  }),

  recharge_2021_11_charges_remove_free_gift: tool({
    description: "Remove free gift items from a charge.",
    parameters: z.object({
      account: accountField,
      charge_id: z.number().describe("Charge ID"),
      external_variant_ids: z.array(z.string()).describe("External variant IDs of gifts to remove"),
    }),
    execute: async ({ account, charge_id, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: `/charges/${charge_id}/remove_free_gift`, body });
      return res.data;
    },
  }),
};
