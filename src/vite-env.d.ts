/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BKK_API_KEY?: string
  readonly VITE_BASE_PATH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
