/**
 * Supabase sync config. Committed on purpose: the anon/publishable key is
 * public-by-design — data protection is row-level security in the database,
 * never secrecy of this file. Empty strings disable sync entirely; a fresh
 * clone runs exactly like the pre-sync, local-only app.
 */
export const SUPABASE_URL: string = 'https://rdhzcvmvtxnzittmclgr.supabase.co'
export const SUPABASE_ANON_KEY: string = 'sb_publishable__QGdeG-Y0kPIafSQpIIfSw__B1MsCKv'
export const SYNC_USER_ID = 'dmitrii'
export const SYNC_ENABLED = SUPABASE_URL !== '' && SUPABASE_ANON_KEY !== ''
