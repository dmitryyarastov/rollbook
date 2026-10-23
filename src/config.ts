/**
 * Supabase sync config. Committed on purpose: the anon/publishable key is
 * public-by-design — data protection is row-level security in the database,
 * never secrecy of this file. Empty strings disable sync entirely; a fresh
 * clone runs exactly like the pre-sync, local-only app.
 */
export const SUPABASE_URL: string = 'https://rdhzcvmvtxnzittmclgr.supabase.co'
export const SUPABASE_ANON_KEY: string = 'sb_publishable__QGdeG-Y0kPIafSQpIIfSw__B1MsCKv'
export const SYNC_USER_ID = 'dmitrii'
/**
 * `VITE_SYNC_OFF=1` (set by `.env.nosync` — `npm run dev -- --mode nosync`)
 * runs the app fully local. Use it for any dev-server session that will tap
 * around with demo data: with sync on, saving a session or editing the
 * focus/tag list pushes to the live database (2026-10-23 incident, see
 * docs/operations.md).
 */
export const SYNC_ENABLED = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== '' && import.meta.env.VITE_SYNC_OFF !== '1'
