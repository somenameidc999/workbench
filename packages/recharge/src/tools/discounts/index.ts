import { tool } from "ai";
import { z } from "zod";
import { rechargeRequest } from "../../client/http";

const accountField = z.string().describe("Recharge account name as defined in workbench.config.ts (e.g. recharge-seed-staging)");

const appliesToSchema = z.object({
  purchase_item_type: z.enum(["subscription", "onetime"]).optional(),
  resource: z.string().optional(),
  resource_ids: z.array(z.number()).optional(),
}).optional();

const channelSettingsSchema = z.object({
  api: z.object({ can_apply: z.boolean() }).optional(),
  checkout_page: z.object({ can_apply: z.boolean() }).optional(),
  customer_portal: z.object({ can_apply: z.boolean() }).optional(),
  merchant_portal: z.object({ can_apply: z.boolean() }).optional(),
}).optional();

const usageLimitsSchema = z.object({
  max_subsequent_usages: z.number().optional(),
  first_time_customer_restriction: z.boolean().optional(),
  one_application_per_customer: z.boolean().optional(),
}).optional();

export const discountTools = {
  recharge_2021_11_discounts_create: tool({
    description: "Create a new discount.",
    parameters: z.object({
      account: accountField,
      code: z.string().describe("Discount code string"),
      value: z.number().describe("Discount value"),
      value_type: z.enum(["fixed_amount", "percentage", "shipping"]),
      applies_to: appliesToSchema,
      channel_settings: channelSettingsSchema,
      ends_at: z.string().optional().describe("ISO datetime when discount expires"),
      prerequisite_subtotal_min: z.number().optional(),
      starts_at: z.string().optional().describe("ISO datetime when discount starts"),
      status: z.enum(["enabled", "disabled", "fully_disabled"]).optional(),
      usage_limits: usageLimitsSchema,
    }),
    execute: async ({ account, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: "/discounts", body });
      return res.data;
    },
  }),

  recharge_2021_11_discounts_get: tool({
    description: "Retrieve a single discount by ID.",
    parameters: z.object({
      account: accountField,
      discount_id: z.number().describe("Discount ID"),
    }),
    execute: async ({ account, discount_id }) => {
      const res = await rechargeRequest({ account, method: "GET", path: `/discounts/${discount_id}` });
      return res.data;
    },
  }),

  recharge_2021_11_discounts_update: tool({
    description: "Update an existing discount.",
    parameters: z.object({
      account: accountField,
      discount_id: z.number().describe("Discount ID"),
      code: z.string().optional(),
      value: z.number().optional(),
      value_type: z.enum(["fixed_amount", "percentage", "shipping"]).optional(),
      applies_to: appliesToSchema,
      channel_settings: channelSettingsSchema,
      ends_at: z.string().optional(),
      prerequisite_subtotal_min: z.number().optional(),
      starts_at: z.string().optional(),
      status: z.enum(["enabled", "disabled", "fully_disabled"]).optional(),
      usage_limits: usageLimitsSchema,
    }),
    execute: async ({ account, discount_id, ...body }) => {
      const res = await rechargeRequest({ account, method: "PUT", path: `/discounts/${discount_id}`, body });
      return res.data;
    },
  }),

  recharge_2021_11_discounts_delete: tool({
    description: "Delete a discount by ID.",
    parameters: z.object({
      account: accountField,
      discount_id: z.number().describe("Discount ID"),
    }),
    execute: async ({ account, discount_id }) => {
      const res = await rechargeRequest({ account, method: "DELETE", path: `/discounts/${discount_id}` });
      return res.data;
    },
  }),

  recharge_2021_11_discounts_list: tool({
    description: "List discounts with optional filters.",
    parameters: z.object({
      account: accountField,
      discount_code: z.string().optional(),
      value_type: z.enum(["fixed_amount", "percentage", "shipping"]).optional(),
      status: z.enum(["enabled", "disabled", "fully_disabled"]).optional(),
      ids: z.string().optional().describe("Comma-separated discount IDs"),
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
        path: "/discounts",
        query: query as Record<string, string | number | boolean | undefined>,
      });
      return res.data;
    },
  }),
};
