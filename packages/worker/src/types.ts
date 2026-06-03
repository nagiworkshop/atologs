export interface Env {
  KV: KVNamespace;
  /** GA4 Measurement Protocol API secret (Production only). Unset → server-side MP silently no-ops. */
  GA4_MP_API_SECRET?: string;
}
