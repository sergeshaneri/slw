// Canonical User shape used across the frontend.
//
// Backend currently lacks `response_model` for `/api/auth/me`, so the OpenAPI
// schema gives `{ [key: string]: unknown }` for the response. We declare the
// fields the frontend actually reads here and keep an index signature so
// future server-side fields don't require fan-out type updates.
//
// NOTE(ts): pending backend response_model. Once the backend ships an
// explicit Pydantic model for `/api/auth/me`, this type can be derived from
// `paths['/api/auth/me']['get']['responses']['200']['content']['application/json']`
// and the index signature dropped.
export type User = {
  id?: number | string
  email?: string | null
  is_admin?: boolean
  telegram_id?: number | string | null
  telegram_first_name?: string | null
  telegram_username?: string | null
  hints_seen?: Record<string, boolean>
  onboarding_done?: boolean
  [key: string]: unknown
}
