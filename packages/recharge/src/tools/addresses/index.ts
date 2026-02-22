import { tool } from "ai";
import { z } from "zod";
import { rechargeRequest } from "../../client/http";

const accountField = z.string().describe("Recharge account name as defined in workbench.config.ts (e.g. recharge-seed-staging)");

export const addressTools = {
  recharge_2021_11_addresses_create: tool({
    description: "Create a new address for a Recharge customer.",
    parameters: z.object({
      account: accountField,
      customer_id: z.number().describe("ID of the customer"),
      address1: z.string(),
      city: z.string(),
      country_code: z.string().describe("ISO 3166-1 alpha-2 country code"),
      first_name: z.string(),
      last_name: z.string(),
      phone: z.string(),
      province: z.string(),
      zip: z.string(),
      address2: z.string().optional(),
      company: z.string().optional(),
      order_attributes: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
      order_note: z.string().optional(),
      payment_method_id: z.number().optional(),
      presentment_currency: z.string().optional(),
      shipping_lines_override: z.array(z.object({ code: z.string(), price: z.string(), title: z.string() })).optional(),
    }),
    execute: async ({ account, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: "/addresses", body });
      return res.data;
    },
  }),

  recharge_2021_11_addresses_get: tool({
    description: "Retrieve a single address by ID.",
    parameters: z.object({
      account: accountField,
      address_id: z.number().describe("Address ID"),
    }),
    execute: async ({ account, address_id }) => {
      const res = await rechargeRequest({ account, method: "GET", path: `/addresses/${address_id}` });
      return res.data;
    },
  }),

  recharge_2021_11_addresses_update: tool({
    description: "Update an existing address.",
    parameters: z.object({
      account: accountField,
      address_id: z.number().describe("Address ID"),
      address1: z.string().optional(),
      address2: z.string().optional(),
      city: z.string().optional(),
      company: z.string().optional(),
      country_code: z.string().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      phone: z.string().optional(),
      province: z.string().optional(),
      zip: z.string().optional(),
      order_attributes: z.array(z.object({ name: z.string(), value: z.string() })).optional(),
      order_note: z.string().optional(),
      payment_method_id: z.number().optional(),
      presentment_currency: z.string().optional(),
      shipping_lines_override: z.array(z.object({ code: z.string(), price: z.string(), title: z.string() })).optional(),
    }),
    execute: async ({ account, address_id, ...body }) => {
      const res = await rechargeRequest({ account, method: "PUT", path: `/addresses/${address_id}`, body });
      return res.data;
    },
  }),

  recharge_2021_11_addresses_delete: tool({
    description: "Delete an address by ID.",
    parameters: z.object({
      account: accountField,
      address_id: z.number().describe("Address ID"),
    }),
    execute: async ({ account, address_id }) => {
      const res = await rechargeRequest({ account, method: "DELETE", path: `/addresses/${address_id}` });
      return res.data;
    },
  }),

  recharge_2021_11_addresses_list: tool({
    description: "List addresses with optional filters.",
    parameters: z.object({
      account: accountField,
      customer_id: z.number().optional(),
      discount_code: z.string().optional(),
      discount_id: z.number().optional(),
      ids: z.string().optional().describe("Comma-separated address IDs"),
      is_active: z.boolean().optional(),
      limit: z.number().optional().describe("Max results (default 50, max 250)"),
      created_at_min: z.string().optional(),
      created_at_max: z.string().optional(),
      updated_at_min: z.string().optional(),
      updated_at_max: z.string().optional(),
    }),
    execute: async ({ account, ...query }) => {
      const res = await rechargeRequest({
        account,
        method: "GET",
        path: "/addresses",
        query: query as Record<string, string | number | boolean | undefined>,
      });
      return res.data;
    },
  }),

  recharge_2021_11_addresses_merge: tool({
    description: "Merge multiple source addresses into a target address.",
    parameters: z.object({
      account: accountField,
      target_address: z.object({ id: z.number() }).describe("Target address to merge into"),
      source_addresses: z.array(z.object({ id: z.number() })).describe("Source addresses to merge from"),
      delete_source_addresses: z.boolean().optional(),
      next_charge_date: z.string().optional(),
    }),
    execute: async ({ account, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: "/addresses/merge", body });
      return res.data;
    },
  }),

  recharge_2021_11_addresses_skip_charge: tool({
    description: "Skip a charge for subscriptions at an address on a given date.",
    parameters: z.object({
      account: accountField,
      address_id: z.number().describe("Address ID"),
      date: z.string().describe("Date of charge to skip (YYYY-MM-DD)"),
      subscription_ids: z.array(z.number()).describe("Subscription IDs to skip"),
    }),
    execute: async ({ account, address_id, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: `/addresses/${address_id}/charges/skip`, body });
      return res.data;
    },
  }),
};
