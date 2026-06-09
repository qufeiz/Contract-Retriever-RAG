/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 + @xenova/transformers are native/server-only — keep them
  // external to the server bundle so they load from node_modules at runtime.
  serverExternalPackages: ["better-sqlite3", "@xenova/transformers"],
  outputFileTracingIncludes: {
    "/api/ask": ["./data-index/**/*"],
  },
};
export default nextConfig;
