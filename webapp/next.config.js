const path = require("path");
const { loadEnvConfig } = require("@next/env");

// Load .env from the project root (one level up from webapp/)
loadEnvConfig(path.resolve(__dirname, ".."));

/** @type {import('next').NextConfig} */
const nextConfig = {};

module.exports = nextConfig;
