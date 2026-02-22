import { tool } from "ai";
import { z } from "zod";
import { rechargeRequest } from "../../client/http";

const accountField = z.string().describe("Recharge account name as defined in workbench.config.ts (e.g. recharge-seed-staging)");

export const customerTools = {
  recharge_2021_11_customers_create: tool({
    description: "Create a new Recharge customer.",
    parameters: z.object({
      account: accountField,
      email: z.string().email(),
      first_name: z.string(),
      last_name: z.string(),
      external_customer_id: z.object({ ecommerce: z.string() }).optional(),
      phone: z.string().optional(),
      tax_exempt: z.boolean().optional(),
    }),
    execute: async ({ account, ...body }) => {
      const res = await rechargeRequest({ account, method: "POST", path: "/customers", body });
      return res.data;
    },
  }),

  recharge_2021_11_customers_get: tool({
    description: "Retrieve a single customer by ID.",
    parameters: z.object({
      account: accountField,
      customer_id: z.number().describe("Customer ID"),
    }),
    execute: async ({ account, customer_id }) => {
      const res = await rechargeRequest({ account, method: "GET", path: `/customers/${customer_id}` });
      return res.data;
    },
  }),

  recharge_2021_11_customers_update: tool({
    description: "Update an existing customer.",
    parameters: z.object({
      account: accountField,
      customer_id: z.number().describe("Customer ID"),
      email: z.string().email().optional(),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      phone: z.string().optional(),
      tax_exempt: z.boolean().optional(),
      apply_credit_to_next_recurring_charge: z.boolean().optional(),
      external_customer_id: z.object({ ecommerce: z.string() }).optional(),
    }),
    execute: async ({ account, customer_id, ...body }) => {
      const res = await rechargeRequest({ account, method: "PUT", path: `/customers/${customer_id}`, body });
      return res.data;
    },
  }),

  recharge_2021_11_customers_delete: tool({
    description: "Delete a customer by ID.",
    parameters: z.object({
      account: accountField,
      customer_id: z.number().describe("Customer ID"),
    }),
    execute: async ({ account, customer_id }) => {
      const res = await rechargeRequest({ account, method: "DELETE", path: `/customers/${customer_id}` });
      return res.data;
    },
  }),

  recharge_2021_11_customers_list: tool({
    description: "List customers with optional filters.",
    parameters: z.object({
      account: accountField,
      email: z.string().optional(),
      hash: z.string().optional().describe("Customer hash"),
      ids: z.string().optional().describe("Comma-separated customer IDs"),
      external_customer_id: z.string().optional(),
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
        path: "/customers",
        query: query as Record<string, string | number | boolean | undefined>,
      });
      return res.data;
    },
  }),

  recharge_2021_11_customers_delivery_schedule: tool({
    description: "Get the delivery schedule for a customer.",
    parameters: z.object({
      account: accountField,
      customer_id: z.number().describe("Customer ID"),
      delivery_count_future: z.number().optional(),
      future_interval: z.number().optional(),
      date_max: z.string().optional(),
    }),
    execute: async ({ account, customer_id, ...query }) => {
      const res = await rechargeRequest({
        account,
        method: "GET",
        path: `/customers/${customer_id}/delivery_schedule`,
        query: query as Record<string, string | number | boolean | undefined>,
      });
      return res.data;
    },
  }),

  recharge_2021_11_customers_credit_summary: tool({
    description: "Get credit summary for a customer.",
    parameters: z.object({
      account: accountField,
      customer_id: z.number().describe("Customer ID"),
    }),
    execute: async ({ account, customer_id }) => {
      const res = await rechargeRequest({ account, method: "GET", path: `/customers/${customer_id}/credit_summary` });
      return res.data;
    },
  }),
};
