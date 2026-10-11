import { supabase } from "../supabase"
import { CATEGORIES, COLORS, LOCATIONS } from "./constants"
import type { Category, ItemColor, ItemLocation } from "./constants"
import type {
  ClaimRequest,
  FoundItem,
  LostItem,
  MatchResult,
} from "./types"
import { requireRole } from "./auth"

const BUCKET = "item-images"
const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export type LostReportInput = {
  category: Category
  color: ItemColor
  location: ItemLocation
  dateFrom: string
  dateTo: string
  description?: string
  image?: File | null
}

export type FoundReportInput = {
  category: Category
  color: ItemColor
  location: ItemLocation
  foundDate: string
  description?: string
  image: File
}

function assertChoice(value: string, options: readonly string[], label: string) {
  if (!options.includes(value)) throw new Error(`ค่า${label}ไม่ถูกต้อง`)
}

function assertTimestamp(value: string, label: string) {
  if (!value || !Number.isFinite(Date.parse(value))) {
    throw new Error(`กรุณาระบุ${label}ให้ถูกต้อง`)
  }
}

function validateImage(file: File) {
  if (!["image/jpeg", "image/png"].includes(file.type)) {
    throw new Error("กรุณาเลือกไฟล์ JPG หรือ PNG")
  }
  if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) {
    throw new Error("ขนาดรูปภาพต้องไม่เกิน 5 MB")
  }
}

function imagePath(folder: "lost" | "found", itemId: string, file: File) {
  const extension = file.type === "image/png" ? "png" : "jpg"
  return `${folder}/${itemId}/${crypto.randomUUID()}.${extension}`
}

async function uploadPublicImage(path: string, file: File): Promise<string> {
  validateImage(file)
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type,
    upsert: false,
  })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}

async function signedInUserId() {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  if (!data.user) throw new Error("กรุณาเข้าสู่ระบบก่อนส่งข้อมูล")
  return data.user.id
}

export async function createLostReport(input: LostReportInput): Promise<{
  item: LostItem
  imageUploadError?: string
}> {
  await requireRole("user")
  assertChoice(input.category, CATEGORIES, "หมวดหมู่")
  assertChoice(input.color, COLORS, "สี")
  assertChoice(input.location, LOCATIONS, "สถานที่")
  assertTimestamp(input.dateFrom, "วันเวลาเริ่มต้น")
  assertTimestamp(input.dateTo, "วันเวลาสิ้นสุด")
  if (Date.parse(input.dateFrom) > Date.parse(input.dateTo)) {
    throw new Error("วันเวลาสิ้นสุดต้องไม่น้อยกว่าวันเวลาเริ่มต้น")
  }
  if ((input.description?.length ?? 0) > 2000) {
    throw new Error("คำอธิบายต้องไม่เกิน 2,000 ตัวอักษร")
  }
  if (input.image) validateImage(input.image)

  const itemId = crypto.randomUUID()
  const { data, error } = await supabase
    .from("lost_items")
    .insert({
      id: itemId,
      user_id: await signedInUserId(),
      category: input.category,
      color: input.color,
      location: input.location,
      date_from: new Date(input.dateFrom).toISOString(),
      date_to: new Date(input.dateTo).toISOString(),
      description: input.description?.trim() || null,
    })
    .select("*")
    .single()
  if (error) throw error

  if (!input.image) return { item: data }

  const path = imagePath("lost", itemId, input.image)
  try {
    const imageUrl = await uploadPublicImage(path, input.image)
    const { data: updated, error: updateError } = await supabase
      .from("lost_items")
      .update({ image_url: imageUrl })
      .eq("id", itemId)
      .select("*")
      .single()
    if (updateError) {
      await supabase.storage.from(BUCKET).remove([path])
      return { item: data, imageUploadError: updateError.message }
    }
    return { item: updated }
  } catch (uploadError) {
    return {
      item: data,
      imageUploadError:
        uploadError instanceof Error ? uploadError.message : "อัปโหลดรูปภาพไม่สำเร็จ",
    }
  }
}

export async function recordFoundItem(input: FoundReportInput): Promise<FoundItem> {
  const profile = await requireRole("staff")
  assertChoice(input.category, CATEGORIES, "หมวดหมู่")
  assertChoice(input.color, COLORS, "สี")
  assertChoice(input.location, LOCATIONS, "สถานที่")
  assertTimestamp(input.foundDate, "วันเวลาที่พบ")
  if ((input.description?.length ?? 0) > 2000) {
    throw new Error("คำอธิบายต้องไม่เกิน 2,000 ตัวอักษร")
  }
  validateImage(input.image)

  const itemId = crypto.randomUUID()
  const path = imagePath("found", itemId, input.image)
  const imageUrl = await uploadPublicImage(path, input.image)

  const { data, error } = await supabase
    .from("found_items")
    .insert({
      id: itemId,
      staff_id: profile.id,
      category: input.category,
      color: input.color,
      location: input.location,
      found_date: new Date(input.foundDate).toISOString(),
      image_url: imageUrl,
      description: input.description?.trim() || null,
    })
    .select("*")
    .single()
  if (error) {
    await supabase.storage.from(BUCKET).remove([path])
    throw error
  }
  return data
}

export async function getMyLostReports(): Promise<LostItem[]> {
  await requireRole("user")
  const { data, error } = await supabase
    .from("lost_items")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

export async function getFoundInventory(): Promise<FoundItem[]> {
  await requireRole("staff")
  const { data, error } = await supabase
    .from("found_items")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

export async function findMatches(lostItemId: string): Promise<MatchResult[]> {
  await requireRole("user")
  const { data, error } = await supabase.rpc("find_matches", {
    p_lost_item_id: lostItemId,
  })
  if (error) throw error
  return data.map((match) => ({
    id: match.found_item_id,
    category: match.category,
    location: match.location,
    color: match.color,
    found_date: match.found_date,
    image_url: match.image_url,
    description: match.description,
    score: match.score,
    percentage: match.percentage,
  }))
}

export async function requestMatchClaim(
  lostItemId: string,
  foundItemId: string,
): Promise<string> {
  await requireRole("user")
  const { data, error } = await supabase.rpc("request_match_claim", {
    p_lost_item_id: lostItemId,
    p_found_item_id: foundItemId,
  })
  if (error) throw error
  return data
}

export async function getMyClaimRequests(): Promise<ClaimRequest[]> {
  await requireRole("user")
  const { data, error } = await supabase
    .from("claim_requests")
    .select("*")
    .order("created_at", { ascending: false })
  if (error) throw error
  return data
}

export async function getStaffClaimQueue(): Promise<ClaimRequest[]> {
  await requireRole("staff")
  const { data, error } = await supabase
    .from("claim_requests")
    .select("*")
    .order("created_at", { ascending: true })
  if (error) throw error
  return data
}

export async function reviewClaimRequest(
  claimRequestId: string,
  approve: boolean,
): Promise<string> {
  await requireRole("staff")
  const { data, error } = await supabase.rpc("review_claim_request", {
    p_claim_request_id: claimRequestId,
    p_approve: approve,
  })
  if (error) throw error
  return data
}

export async function closeLostReport(lostItemId: string): Promise<LostItem> {
  await requireRole("user")
  const { data, error } = await supabase
    .from("lost_items")
    .update({ status: "closed" })
    .eq("id", lostItemId)
    .select("*")
    .single()
  if (error) throw error
  return data
}

export async function getDashboard(weeks = 8) {
  await requireRole("staff")
  const [summaryResult, weeklyResult] = await Promise.all([
    supabase.rpc("get_dashboard_summary"),
    supabase.rpc("get_weekly_stats", { p_weeks: weeks }),
  ])
  if (summaryResult.error) throw summaryResult.error
  if (weeklyResult.error) throw weeklyResult.error
  return { summary: summaryResult.data[0], weekly: weeklyResult.data }
}
