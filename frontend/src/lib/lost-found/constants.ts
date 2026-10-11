export const CATEGORIES = [
  "โทรศัพท์",
  "กระเป๋า",
  "กุญแจ",
  "เอกสาร",
  "เครื่องประดับ",
  "อุปกรณ์อิเล็กทรอนิกส์",
  "เสื้อผ้า",
  "อื่นๆ",
] as const

export const COLORS = [
  "ดำ",
  "ขาว",
  "แดง",
  "น้ำเงิน",
  "เขียว",
  "เหลือง",
  "ชมพู",
  "ม่วง",
  "ส้ม",
  "น้ำตาล",
  "เทา",
  "หลายสี",
] as const

export const LOCATIONS = [
  "อาคาร A ชั้น 1",
  "อาคาร A ชั้น 2",
  "อาคาร A ชั้น 3",
  "อาคาร B ชั้น 1",
  "อาคาร B ชั้น 2",
  "อาคาร B ชั้น 3",
  "อาคาร C ชั้น 1",
  "อาคาร C ชั้น 2",
  "อาคาร C ชั้น 3",
  "โรงอาหาร",
  "ห้องสมุด",
  "ลานจอดรถ",
  "สนามกีฬา",
  "อื่นๆ",
] as const

export type Category = (typeof CATEGORIES)[number]
export type ItemColor = (typeof COLORS)[number]
export type ItemLocation = (typeof LOCATIONS)[number]
