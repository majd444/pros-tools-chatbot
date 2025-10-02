/** @type {import('convex/cli').Config} */
module.exports = {
  // Configuration for the Convex backend
  backend: {
    // The path to your Convex functions
    functions: "./convex",
    // The path to your database schema
    schema: "./convex/schema.ts",
  },
  // Configuration for the Convex dashboard
  dashboard: {
    // The URL of your Convex dashboard
    url: "https://dashboard.convex.dev"
  },
  // Enable development mode
  development: process.env.NODE_ENV !== 'production',
};
