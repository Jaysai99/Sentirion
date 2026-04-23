/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for the minimal Docker image (copies only what's needed to run)
  output: "standalone",

  // Expose the backend URL to server-side API routes
  env: {
    SENTIRION_BACKEND_URL:
      process.env.SENTIRION_BACKEND_URL ?? "http://127.0.0.1:3001",
  },
};

export default nextConfig;
