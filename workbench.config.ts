export default {
  stores: [
    ...(process.env.SEED_DEV_STORE_APP_CLIENT_ID
      ?
      [
        {
          "name": "seed-dev-store",
          "client_id": process.env.SEED_DEV_STORE_APP_CLIENT_ID ?? "",
          "client_secret": process.env.SEED_DEV_STORE_APP_CLIENT_SECRET ?? "",
        }
      ] : []),
    ...(process.env.SEED_STAGING_APP_CLIENT_ID
      ?
      [
        {
          "name": "seed-staging",
          "client_id": process.env.SEED_STAGING_APP_CLIENT_ID ?? "",
          "client_secret": process.env.SEED_STAGING_APP_CLIENT_SECRET ?? "",
        }
      ]
      : []),
    ...(process.env.ITALIST_SHOP_APP_CLIENT_ID
      ?
      [
        {
          "name": "italist-shop",
          "client_id": process.env.ITALIST_SHOP_APP_CLIENT_ID ?? "",
          "client_secret": process.env.ITALIST_SHOP_APP_CLIENT_SECRET ?? "",
        }
      ]
      : []),
    ...(process.env.SEED_STAGING_RECHARGE_API_TOKEN
      ?
      [
        {
          "name": "recharge-seed-staging",
          "access_token": process.env.SEED_STAGING_RECHARGE_API_TOKEN ?? "",
        }
      ]
      : []),
  ],
};