import type { User } from "@supabase/supabase-js"
import { assertSupabaseConfigured, supabase } from "../supabase"
import type { Profile, UserRole } from "./types"

export async function signUp(input: {
  email: string
  password: string
  fullName: string
}) {
  assertSupabaseConfigured()
  const fullName = input.fullName.trim()
  if (!fullName) throw new Error("กรุณากรอกชื่อ–นามสกุล")
  if (input.password.length < 8) throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")

  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: { data: { full_name: fullName } },
  })
  if (error) throw error
  return data
}

export async function getMyProfile(): Promise<Profile | null> {
  assertSupabaseConfigured()
  const { data: userData, error: userError } = await supabase.auth.getUser()
  if (userError) throw userError
  if (!userData.user) return null

  const { data, error } = await supabase
    .from("profiles")
    .select("id,email,role,full_name,created_at")
    .eq("id", userData.user.id)
    .maybeSingle()
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string): Promise<{
  user: User
  profile: Profile
}> {
  assertSupabaseConfigured()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  })
  if (error) throw error

  const profile = await getMyProfile()
  if (!profile) {
    await supabase.auth.signOut()
    throw new Error("ไม่พบข้อมูลโปรไฟล์ กรุณาติดต่อเจ้าหน้าที่")
  }
  return { user: data.user, profile }
}

export async function signOut() {
  assertSupabaseConfigured()
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

export async function requireRole(expectedRole: UserRole): Promise<Profile> {
  const profile = await getMyProfile()
  if (!profile) throw new Error("กรุณาเข้าสู่ระบบก่อนใช้งาน")
  if (profile.role !== expectedRole) throw new Error("คุณไม่มีสิทธิ์เข้าถึงหน้านี้")
  return profile
}
