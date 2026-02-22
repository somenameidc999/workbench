import { tool } from "ai";
import { z } from "zod";
import { rechargeRequest } from "../../client/http";

const accountField = z.string().describe("Recharge account name as defined in workbench.config.ts (e.g. recharge-seed-staging)");

const propertySchema = z.object({ name: z.string(), value: z.string() });

const recipientAddressSchema = z.object({
  address1: z.string(),
  city: z.string(),
  country_code: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string(),
  province: z.string(),
  zip: z.string(),
  email: z.string().email(),
  address2: z.string().optional(),
  company: z.string().optional(),
});

export const subscriptionTools = {
  recharge_2021_11_subscriptions_create: tool({
    description: "Create a new subscription.",
    parameters: z.object({
      account: accountField,
      address_id: z.number().describe("Address to attach subscription to"),
      charge_interval_frequency: z.number().max(1000),
      next_charge_scheduled_at: z.string().describe("ISO date for first charge"),
      order_interval_frequency: z.number().max(1000),
      order_interval_unit: z.enum(["day", "week", "month"]),
      quantity: z.number().int().positive(),
      external_variant_id: z.object({ ecommerce: z.string() }),
      price: z.string().optional(),
      product_title: z.string().optional(),
      properties: z.array(propertySchema).optional(),
      expire_after_specific_number_of_charges: z.number().optional(),
      order_day_of_month: z.number().optional(),
      order_day_of_week: z.number().optional(),
      plan_id: z.number().optional(),
      external_product_id: z.object({ ecommerce: z.string() }).optional(),
      status: z.enum(["active", "cancelled", "expired"]).optional(),
    }),
    execute: async ({ account, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: "/subscriptions", body });
      return res.data;
    },
  }),

  recharge_2021_11_subscriptions_get: tool({
    description: "Retrieve a single subscription by ID.",
    parameters: z.object({
      account: accountField,
      subscription_id: z.number().describe("Subscription ID"),
    }),
    execute: async ({ account, subscription_id }) => {
      const res = await rechargeRequest({ account, method: "GET", path: `/subscriptions/${subscription_id}` });
      return res.data;
    },
  }),

  recharge_2021_11_subscriptions_update: tool({
    description: "Update an existing subscription.",
    parameters: z.object({
      account: accountField,
      subscription_id: z.number().describe("Subscription ID"),
      charge_interval_frequency: z.number().max(1000).optional(),
      order_interval_frequency: z.number().max(1000).optional(),
      order_interval_unit: z.enum(["day", "week", "month"]).optional(),
      quantity: z.number().int().positive().optional(),
      price: z.string().optional(),
      external_variant_id: z.object({ ecommerce: z.string() }).optional(),
      product_title: z.string().optional(),
      properties: z.array(propertySchema).optional(),
      sku: z.string().optional(),
      sku_override: z.boolean().optional(),
      variant_title: z.string().optional(),
      expire_after_specific_number_of_charges: z.number().optional(),
      order_day_of_month: z.number().optional(),
      order_day_of_week: z.number().optional(),
      plan_id: z.number().optional(),
      use_external_variant_defaults: z.boolean().optional(),
      commit: z.boolean().optional().describe("Query param: commit update immediately"),
      force_update: z.boolean().optional().describe("Query param: force update"),
    }),
    execute: async ({ account, subscription_id, commit, force_update, ...body }) => {
      const query: Record<string, string | boolean | undefined> = {};
      if (commit !== undefined) query.commit = commit;
      if (force_update !== undefined) query.force_update = force_update;
      const res = await rechargeRequest({ account, method: "PUT", path: `/subscriptions/${subscription_id}`, body, query });
      return res.data;
    },
  }),

  recharge_2021_11_subscriptions_delete: tool({
    description: "Delete a subscription by ID.",
    parameters: z.object({
      account: accountField,
      subscription_id: z.number().describe("Subscription ID"),
      send_email: z.boolean().optional(),
    }),
    execute: async ({ account, subscription_id, send_email }) => {
      const query: Record<string, boolean | undefined> = {};
      if (send_email !== undefined) query.send_email = send_email;
      const res = await rechargeRequest({ account, method: "DELETE", path: `/subscriptions/${subscription_id}`, query });
      return res.data;
    },
  }),

  recharge_2021_11_subscriptions_list: tool({
    description: "List subscriptions with optional filters.",
    parameters: z.object({
      account: accountField,
      address_id: z.number().optional(),
      address_ids: z.string().optional().describe("Comma-separated address IDs"),
      customer_id: z.number().optional(),
      external_variant_id: z.string().optional(),
      ids: z.string().optional().describe("Comma-separated subscription IDs"),
      status: z.enum(["active", "cancelled", "expired"]).optional(),
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
        path: "/subscriptions",
        query: query as Record<string, string | number | boolean | undefined>,
      });
      return res.data;
    },
  }),

  recharge_2021_11_subscriptions_set_next_charge_date: tool({
    description: "Set the next charge date for a subscription.",
    parameters: z.object({
      account: accountField,
      subscription_id: z.number().describe("Subscription ID"),
      date: z.string().describe("New next charge date (YYYY-MM-DD)"),
    }),
    execute: async ({ account, subscription_id, date }) => {
      const res = await rechargeRequest({
        account,
        method: "POST",
        path: `/subscriptions/${subscription_id}/set_next_charge_date`,
        body: { date },
      });
      return res.data;
    },
  }),

  recharge_2021_11_subscriptions_change_address: tool({
    description: "Move a subscription to a different address.",
    parameters: z.object({
      account: accountField,
      subscription_id: z.number().describe("Subscription ID"),
      address_id: z.number().describe("New address ID"),
      next_charge_scheduled_at: z.string().optional(),
    }),
    execute: async ({ account, subscription_id, ...body }) => {
      const res = await rechargeRequest({
        account,
        method: "POST",
        path: `/subscriptions/${subscription_id}/change_address`,
        body,
      });
      return res.data;
    },
  }),

  recharge_2021_11_subscriptions_cancel: tool({
    description: "Cancel a subscription.",
    parameters: z.object({
      account: accountField,
      subscription_id: z.number().describe("Subscription ID"),
      cancellation_reason: z.string(),
      cancellation_reason_comments: z.string().optional(),
      send_email: z.boolean().optional(),
    }),
    execute: async ({ account, subscription_id, ...body }) => {
      const res = await rechargeRequest({
        account,
        method: "POST",
        path: `/subscriptions/${subscription_id}/cancel`,
        body,
      });
      return res.data;
    },
  }),

  recharge_2021_11_subscriptions_activate: tool({
    description: "Activate a cancelled subscription.",
    parameters: z.object({
      account: accountField,
      subscription_id: z.number().describe("Subscription ID"),
    }),
    execute: async ({ account, subscription_id }) => {
      const res = await rechargeRequest({
        account,
        method: "POST",
        path: `/subscriptions/${subscription_id}/activate`,
      });
      return res.data;
    },
  }),

  recharge_2021_11_subscriptions_skip_gift: tool({
    description: "Send a subscription as a one-time gift to a different address.",
    parameters: z.object({
      account: accountField,
      purchase_item_ids: z.array(z.number()).describe("Purchase item IDs to gift"),
      recipient_address: recipientAddressSchema.describe("Full recipient address for the gift"),
    }),
    execute: async ({ account, ...body }) => {
      const res = await rechargeRequest({
        account,
        method: "POST",
        path: "/subscriptions/gift",
        body,
      });
      return res.data;
    },
  }),
};
