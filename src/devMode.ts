export const isMockAuthEnabled = import.meta.env.MODE !== 'test' && import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'
export const MOCK_USER_ID = 'local-dev-user'
