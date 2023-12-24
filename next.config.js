/** @type {import('next').NextConfig} */

let withBundleAnalyzer = require("@next/bundle-analyzer")({
    enabled: process.env.ANALYZE === "true",
});

const nextConfig = {
  reactStrictMode: false, // Recommended for the `pages` directory, default in `app`.
  distDir: 'docs',
  output: 'export',
  basePath: '/mastering-einsum',
  assetPrefix: '/mastering-einsum/',
  typescript: {
    // !! WARN !!
    // Dangerously allow production builds to successfully complete even if
    // your project has type errors.
    // !! WARN !!
    ignoreBuildErrors: true,

  },
  productionBrowserSourceMaps: true,
  experimental: {
    appDir: true,
  },
  // redirects: async () => {
  //   return [
  //     {
  //       source: "/llm-viz",
  //       destination: "/llm",
  //       permanent: true,
  //     },
  //   ];
  // }
};

module.exports = withBundleAnalyzer(nextConfig);
