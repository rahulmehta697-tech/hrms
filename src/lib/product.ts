/**
 * Your product's own brand, shown as “Powered by …” on every customer's deployment.
 * Change the defaults here once, or override them per deployment with environment variables.
 */
export const PRODUCT = {
  name: process.env.PRODUCT_NAME || "HRMS",
  url: process.env.PRODUCT_URL || "",
  support: process.env.PRODUCT_SUPPORT || "",
};
export const poweredBy = () => `Powered by ${PRODUCT.name}`;
