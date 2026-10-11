import type { Category, ItemColor, ItemLocation } from "./constants"

export type UserRole = "user" | "staff"
export type LostStatus = "open" | "matched" | "closed"
export type FoundStatus = "available" | "matched" | "claimed"
export type ClaimStatus = "pending" | "approved" | "rejected" | "cancelled"

export type Profile = {
  id: string
  email: string
  role: UserRole
  full_name: string | null
  created_at: string
}

export type LostItem = {
  id: string
  user_id: string
  category: Category
  location: ItemLocation
  color: ItemColor
  date_from: string
  date_to: string
  image_url: string | null
  description: string | null
  status: LostStatus
  created_at: string
}

export type FoundItem = {
  id: string
  staff_id: string
  category: Category
  location: ItemLocation
  color: ItemColor
  found_date: string
  image_url: string
  description: string | null
  status: FoundStatus
  created_at: string
}

export type MatchResult = Pick<
  FoundItem,
  "id" | "category" | "location" | "color" | "found_date" | "image_url" | "description"
> & { score: number; percentage: number }

export type ClaimRequest = {
  id: string
  requester_id: string
  lost_item_id: string
  found_item_id: string
  status: ClaimStatus
  created_at: string
  updated_at: string
}

type Table<Row, Insert, Update> = {
  Row: Row
  Insert: Insert
  Update: Update
  Relationships: []
}

export type Database = {
  public: {
    Tables: {
      profiles: Table<
        Profile,
        Pick<Profile, "id" | "email"> & Partial<Pick<Profile, "full_name" | "role" | "created_at">>,
        Partial<Pick<Profile, "email" | "full_name" | "role">>
      >
      lost_items: Table<
        LostItem,
        Pick<LostItem, "user_id" | "category" | "location" | "color" | "date_from" | "date_to"> &
          Partial<Pick<LostItem, "id" | "image_url" | "description" | "status" | "created_at">>,
        Partial<Pick<LostItem, "category" | "location" | "color" | "date_from" | "date_to" | "image_url" | "description" | "status">>
      >
      found_items: Table<
        FoundItem,
        Pick<FoundItem, "staff_id" | "category" | "location" | "color" | "found_date" | "image_url"> &
          Partial<Pick<FoundItem, "id" | "description" | "status" | "created_at">>,
        Partial<Pick<FoundItem, "category" | "location" | "color" | "found_date" | "image_url" | "description" | "status">>
      >
      claim_requests: Table<
        ClaimRequest,
        Pick<ClaimRequest, "requester_id" | "lost_item_id" | "found_item_id"> &
          Partial<Pick<ClaimRequest, "id" | "status" | "created_at" | "updated_at">>,
        Partial<Pick<ClaimRequest, "status" | "updated_at">>
      >
    }
    Views: Record<string, never>
    Functions: {
      find_matches: {
        Args: { p_lost_item_id: string }
        Returns: Array<{
          found_item_id: string
          category: Category
          location: ItemLocation
          color: ItemColor
          found_date: string
          image_url: string
          description: string | null
          score: number
          percentage: number
        }>
      }
      request_match_claim: {
        Args: { p_lost_item_id: string; p_found_item_id: string }
        Returns: string
      }
      review_claim_request: {
        Args: { p_claim_request_id: string; p_approve: boolean }
        Returns: string
      }
      get_dashboard_summary: {
        Args: Record<string, never>
        Returns: Array<{
          total_lost: number
          total_found: number
          matched: number
          pending: number
        }>
      }
      get_weekly_stats: {
        Args: { p_weeks?: number }
        Returns: Array<{
          week_start: string
          lost_count: number
          found_count: number
        }>
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
