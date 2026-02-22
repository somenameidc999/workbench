import { addressTools } from "./addresses";
import { customerTools } from "./customers";
import { subscriptionTools } from "./subscriptions";
import { chargeTools } from "./charges";
import { discountTools } from "./discounts";
import { productTools } from "./products";
import { collectionTools } from "./collections";

export const allRechargeTools = {
  ...addressTools,
  ...customerTools,
  ...subscriptionTools,
  ...chargeTools,
  ...discountTools,
  ...productTools,
  ...collectionTools,
};
