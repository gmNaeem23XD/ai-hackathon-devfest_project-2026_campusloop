export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Campusloop";
export const ORGANIZATION_NAME = process.env.NEXT_PUBLIC_ORGANIZATION_NAME || "Daffodil International University";
export const SPLASH_ENABLED = process.env.NEXT_PUBLIC_SPLASH_ENABLED !== "false";
const configuredSplashDuration = Number(process.env.NEXT_PUBLIC_SPLASH_DURATION_MS || 3000);
export const SPLASH_DURATION_MS = Number.isFinite(configuredSplashDuration) && configuredSplashDuration >= 1200
	? configuredSplashDuration
	: 3000;
