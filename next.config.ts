import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	turbopack: {
		root: process.cwd(),
	},
	outputFileTracingIncludes: {
		"/*": ["data/cleaned/**/*.csv", "data/cleaned/*.txt"],
	},
};

export default nextConfig;
