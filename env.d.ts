/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
	readonly VITE_DEV_AUTH_BYPASS?: string
}

declare const __BUILD_TIME__: string

