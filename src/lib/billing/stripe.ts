import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

/**
 * The server-side Stripe client. The secret key never leaves the server.
 * STRIPE_API_HOST/PORT/PROTOCOL exist only to point tests at stripe-mock.
 */
export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  if (!client) {
    client = new Stripe(key, {
      maxNetworkRetries: 2,
      appInfo: { name: "Nerox" },
      ...(process.env.STRIPE_API_HOST
        ? {
            host: process.env.STRIPE_API_HOST,
            port: process.env.STRIPE_API_PORT ?? "443",
            protocol: (process.env.STRIPE_API_PROTOCOL as "http" | "https") ?? "https",
          }
        : {}),
    });
  }
  return client;
}
