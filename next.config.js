/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  eslint: {
    // Disable ESLint during builds - linting should be done separately
    ignoreDuringBuilds: true,
  },
  typescript: {
    // We already run typecheck separately, so we can skip it during build
    ignoreBuildErrors: false,
  },
};

export default config;
