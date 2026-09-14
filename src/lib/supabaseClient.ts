import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Defensive about missing env vars, same pattern used in IELTSGate: a preview
// build without secrets configured should still render the UI instead of a
// blank crashed page. `isSupabaseConfigured` lets screens show a real warning
// instead of pretending auth/data calls will work.
export const isSupabaseConfigured = Boolean(url && anonKey)

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[Scholar] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are not set. ' +
      'Auth and data calls will fail until supabase/migrations/0001_init.sql ' +
      'has been run on a Supabase project and the env vars are set in .env.',
  )
}

// Not using the generated `Database` generic here on purpose: this project's
// schema types (src/types/database.ts) are hand-written ahead of a real
// Supabase project existing. Once the project is created, regenerate real
// types with `npx supabase gen types typescript --project-id <ref>` and wire
// them back in as `createClient<Database>(...)` — until then the app-level
// mapping in src/lib/mappers.ts + src/lib/data.ts is the source of truth for
// shaping rows into the domain types the UI actually uses.
export const supabase = createClient(
  url || 'https://placeholder.supabase.co',
  anonKey || 'placeholder-anon-key',
  { auth: { flowType: 'pkce' } },
)
