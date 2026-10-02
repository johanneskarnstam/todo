/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
	readonly VITE_DEV_AUTH_BYPASS?: string
	readonly VITE_FIREBASE_VAPID_KEY?: string
	readonly VITE_RECAPTCHA_ENTERPRISE_SITE_KEY?: string
}

interface Window {
	FIREBASE_APPCHECK_DEBUG_TOKEN?: boolean | string
}

declare const __BUILD_TIME__: string

