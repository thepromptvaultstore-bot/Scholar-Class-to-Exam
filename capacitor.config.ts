import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.thepromptvault.scholar',
  appName: 'Scholar',
  webDir: 'dist',
  // Deliberately left unset (no `server` block): the Android app loads the
  // bundled web assets offline from `dist/`, same pattern as IELTSGate — it
  // does not need a live connection to any hosted URL to render its UI, only
  // for the actual Supabase API calls (auth, data, storage, edge functions).
}

export default config
