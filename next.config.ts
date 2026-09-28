import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // El visor abre la app en 127.0.0.1. En desarrollo Next solo sirve
  // los assets de cliente a localhost, salvo que se permita este host.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
