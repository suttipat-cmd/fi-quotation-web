import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'https://qlqkhqecputnnbuylxls.supabase.co'
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_ENvUNUI85GCt11_5HEkbnQ_e6BZWvzs'

export const supabase = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } })
