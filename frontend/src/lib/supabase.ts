import { createClient } from "@supabase/supabase-js"
import type { Database } from "./lost-found/types"

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    !/YOUR_PROJECT_REF|REPLACE_ME/i.test(`${supabaseUrl} ${supabasePublishableKey}`),
)

export function assertSupabaseConfigured() {
  if (!isSupabaseConfigured) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า Supabase: เพิ่ม Project URL และ Publishable key ใน frontend/.env.local แล้วเริ่มเว็บใหม่",
    )
  }
}

export const supabase = createClient<Database>(
  supabaseUrl || "https://not-configured.supabase.co",
  supabasePublishableKey || "not-configured",
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  },
)
