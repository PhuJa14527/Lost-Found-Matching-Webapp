import { useEffect, useState, type ReactNode, type FormEvent } from "react"
import {
  createLostReport,
  findMatches,
  getDashboard,
  getFoundInventory,
  getMyClaimRequests,
  getMyLostReports,
  recordFoundItem,
  requestMatchClaim,
} from "./lib/lost-found/api"
import { CATEGORIES, COLORS, LOCATIONS } from "./lib/lost-found/constants"
import type { FoundItem, LostItem, MatchResult } from "./lib/lost-found/types"
import { requireRole, signIn, signOut, signUp } from "./lib/lost-found/auth"
import { isSupabaseConfigured } from "./lib/supabase"

type IconName = "search" | "bag" | "mail" | "lock" | "eye" | "back" | "arrow" | "person" | "pin" | "calendar" | "camera" | "send" | "check" | "dashboard" | "menu" | "save" | "list" | "clock" | "refresh" | "close" | "shield" | "plus" | "logout"
function Icon({ name, size = 22 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    bag: (
      <>
        <rect x="5" y="7" width="14" height="14" rx="3" />
        <path d="M9 7V5a3 3 0 0 1 6 0v2M9 12h6M9 16h6" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    back: <path d="m14 5-7 7 7 7M7 12h14" />,
    arrow: <path d="m9 5 7 7-7 7" />,
    person: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    pin: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4M17 3v4M3 10h18M8 14h2M14 14h2M8 17h2" />
      </>
    ),
    camera: (
      <>
        <path d="M3 7h4l2-3h6l2 3h4v13H3Z" />
        <circle cx="12" cy="13" r="4" />
      </>
    ),
    send: (
      <>
        <path d="m3 3 19 9-19 9 4-9-4-9ZM7 12h15" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    dashboard: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    menu: <path d="M4 6h16M4 12h16M4 18h16" />,
    save: (
      <>
        <path d="M4 3h13l4 4v14H3V3h1ZM7 3v6h9V3M7 21v-8h10v8" />
      </>
    ),
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.1M3 12h.1M3 18h.1" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    refresh: (
      <>
        <path d="M20 7a9 9 0 1 0 1 8M20 3v5h-5" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    logout: (
      <>
        <path d="M9 4H4v16h5M9 12h12m-4-4 4 4-4 4" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

type Page = "home" | "login" | "signup" | "report" | "results" | "record" | "dashboard" | "inventory"
const routes: Record<Page, string> = {
  home: "index.html",
  login: "login.html",
  signup: "sign-in.html",
  report: "user-report.html",
  results: "user-results.html",
  record: "staff-record.html",
  dashboard: "staff-dashboard.html",
  inventory: "staff-inventory.html",
}
function currentPage(): Page {
  return (
    (Object.keys(routes) as Page[]).find((p) =>
      location.pathname.endsWith(routes[p]),
    ) || "home"
  )
}
const categories = [...CATEGORIES]
const colors = [...COLORS]
const locations = [...LOCATIONS]

function Button({
  children,
  icon,
  secondary = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: IconName
  secondary?: boolean
}) {
  return (
    <button
      {...props}
      className={`button ${
        secondary ? "secondary" : ""
      } ${props.className || ""}`}
    >
      {icon && <Icon name={icon} size={20} />}
      {children}
    </button>
  )
}
function Card({
  title,
  icon,
  children,
}: {
  title?: string
  icon?: IconName
  children: ReactNode
}) {
  return (
    <section className="card">
      {title && (
        <div className="section-label">
          {icon && <Icon name={icon} size={17} />}
          {title}
        </div>
      )}
      {children}
    </section>
  )
}

function HomePage({
  onLogin,
  onSignup,
}: {
  onLogin: () => void
  onSignup: () => void
}) {
  return (
    <div className="park-home">
      <header className="park-nav">
        <div className="park-brand">
          <span>
            <Icon name="bag" size={21} />
          </span>
          <strong>
            Lost & Found<span>YOUR HAPPY PLACE</span>
          </strong>
        </div>
        <div className="park-auth-actions">
          <Button secondary className="park-login" onClick={onLogin}>
            Log in
          </Button>
          <Button className="park-login park-signup" onClick={onSignup}>
            Sign in
            <Icon name="arrow" size={14} />
          </Button>
        </div>
      </header>
      <main>
        <section className="park-intro">
          <div className="park-eyebrow">
            <span /> LESS WORRY, MORE FUN
          </div>
          <h1>
            ความสนุกไม่ต้องหยุด
            <br />
            เพราะ<span>ของหาย</span>
          </h1>
          <p>
            เล่นให้เต็มที่ แล้วให้เราช่วยตามหา
            <br />
            สิ่งของที่หายไปในสวนสนุกและสวนน้ำ
          </p>
          <Button icon="search" onClick={onLogin}>
            เริ่มตามหาของหาย
            <Icon name="arrow" size={18} />
          </Button>
          <span className="park-reassurance">
            <Icon name="shield" size={14} /> แจ้งง่าย ไม่กี่ขั้นตอน · มีเจ้าหน้าที่คอยดูแล
          </span>
        </section>
        <section className="park-scene" aria-label="บรรยากาศสวนสนุกและสวนน้ำ">
          <img
            src="/park-scene.svg"
            alt="ชิงช้าสวรรค์สีสันสดใสใต้ท้องฟ้าสีฟ้า"
          />
          <span className="park-scene-label">
            A LITTLE LOST. A LOT OF HOPE.
          </span>
          <svg
            className="park-waves"
            viewBox="0 0 480 64"
            preserveAspectRatio="none"
            aria-hidden="true"
          >
            <path
              d="M0 28Q60 0 120 28T240 28T360 28T480 28V64H0Z"
              className="wave-back"
            />
            <path
              d="M0 45Q60 17 120 45T240 45T360 45T480 45V64H0Z"
              className="wave-front"
            />
          </svg>
        </section>
        <section className="park-how">
          <div className="park-eyebrow">SIMPLE STEPS, HAPPY ENDINGS</div>
          <h2>ตามหาง่าย ๆ ใน 3 ขั้นตอน</h2>
          <div className="park-how-grid">
            {[
              {
                icon: "list",
                title: "แจ้งของหาย",
                text: "บอกลักษณะสิ่งของ\nและเวลาที่จำได้",
              },
              {
                icon: "search",
                title: "ดูรายการที่พบ",
                text: "ตรวจสอบรูปภาพ\nของที่อาจตรงกัน",
              },
              {
                icon: "check",
                title: "รับของคืน",
                text: "ยืนยันกับเจ้าหน้าที่\nแล้วกลับไปสนุกต่อ",
              },
            ].map((step, index) => (
              <div className="park-how-step" key={step.title}>
                <div className="park-step-icon">
                  <Icon name={step.icon as IconName} size={24} />
                  <span>{index + 1}</span>
                </div>
                <h3>{step.title}</h3>
                <p>{step.text}</p>
              </div>
            ))}
          </div>
        </section>
        <section className="park-help">
          <span className="park-help-icon">
            <Icon name="person" size={25} />
          </span>
          <div>
            <h3>เจอของที่ใครทำหล่นไว้?</h3>
            <p>
              นำส่งได้ที่จุดบริการของหายภายในสวน
              <br />
              ให้เจ้าหน้าที่ช่วยส่งคืนเจ้าของ
            </p>
          </div>
        </section>
      </main>
      <footer className="park-footer">
        <Icon name="bag" size={15} />
        <span>เก็บความทรงจำดี ๆ ให้ของหายเป็นเรื่องของเรา</span>
      </footer>
    </div>
  )
}
function SelectField({
  label,
  options,
  value,
  onChange,
  helper,
}: {
  label: string
  options: readonly string[]
  value: string
  onChange: (v: string) => void
  helper?: string
}) {
  return (
    <label className="field">
      <span>
        {label} <b className="required">*</b>
      </span>
      <select required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">เลือก{label}</option>
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
      {helper && <small>{helper}</small>}
    </label>
  )
}
export default function App() {
  const [page, setPage] = useState<Page>(currentPage)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [fullName, setFullName] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [signupError, setSignupError] = useState("")
  const [category, setCategory] = useState("")
  const [color, setColor] = useState("")
  const [place, setPlace] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [foundDate, setFoundDate] = useState("")
  const [note, setNote] = useState("")
  const [uploads, setUploads] = useState<File[]>([])
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([])
  const [photoError, setPhotoError] = useState(false)
  const [toast, setToast] = useState("")
  const [drawer, setDrawer] = useState(false)
  const [detail, setDetail] = useState<string | null>(null)
  const [claim, setClaim] = useState<string | null>(null)
  const [claimed, setClaimed] = useState<string[]>([])
  const [items, setItems] = useState<FoundItem[]>([])
  const [matches, setMatches] = useState<MatchResult[]>([])
  const [lostReport, setLostReport] = useState<LostItem | null>(null)
  const [lostItemId, setLostItemId] = useState(() => new URLSearchParams(location.search).get("id") ?? "")
  const [dashboard, setDashboard] = useState<Awaited<ReturnType<typeof getDashboard>> | null>(null)
  const [busy, setBusy] = useState(false)
  const [range, setRange] = useState("8")
  const [refreshing, setRefreshing] = useState(false)
  useEffect(() => {
    const handler = () => setPage(currentPage())
    window.addEventListener("popstate", handler)
    return () => window.removeEventListener("popstate", handler)
  }, [])
  useEffect(() => {
    let active = true
    const requiredRole = page === "report" || page === "results" ? "user"
      : page === "record" || page === "dashboard" || page === "inventory" ? "staff"
      : null
    if (requiredRole) {
      requireRole(requiredRole).catch(() => {
        if (active) {
          setToast("กรุณาเข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์")
          navigate("login")
        }
      })
    }
    return () => { active = false }
  }, [page])
  useEffect(() => {
    let active = true
    async function loadPageData() {
      try {
        if (page === "inventory") setItems(await getFoundInventory())
        if (page === "dashboard") setDashboard(await getDashboard(Number(range)))
        if (page === "results" && lostItemId) {
          const [resultItems, requests, reports] = await Promise.all([findMatches(lostItemId), getMyClaimRequests(), getMyLostReports()])
          setMatches(resultItems)
          setLostReport(reports.find((report) => report.id === lostItemId) ?? null)
          setClaimed(requests.filter((request) => request.status === "pending" || request.status === "approved").map((request) => request.found_item_id))
        }
      } catch (error) {
        if (active) setToast(error instanceof Error ? error.message : "โหลดข้อมูลไม่สำเร็จ")
      }
    }
    void loadPageData()
    return () => { active = false }
  }, [page, lostItemId, range])
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(""), 3000)
      return () => clearTimeout(timer)
    }
  }, [toast])
  function navigate(next: Page, query = "") {
    history.pushState({}, "", `/${routes[next]}${query}`)
    setPage(next)
    setDrawer(false)
    window.scrollTo(0, 0)
  }
  function resetForm() {
    setCategory("")
    setColor("")
    setPlace("")
    setDateFrom("")
    setDateTo("")
    setFoundDate("")
    setNote("")
    setUploads([])
    setUploadPreviews([])
    setPhotoError(false)
  }
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (page === "record" && !uploads.length) {
      setPhotoError(true)
      document
        .getElementById("upload-zone")
        ?.scrollIntoView({ behavior: "smooth", block: "center" })
      return
    }
    setBusy(true)
    try {
      if (page === "report") {
        const { item, imageUploadError } = await createLostReport({
          category: category as (typeof CATEGORIES)[number],
          color: color as (typeof COLORS)[number],
          location: place as (typeof LOCATIONS)[number],
          dateFrom: dateFrom ? new Date(dateFrom).toISOString() : "",
          dateTo: dateTo ? new Date(dateTo).toISOString() : "",
          description: note,
          image: uploads[0] ?? null,
        })
        setLostItemId(item.id)
        if (imageUploadError) setToast(`บันทึกรายงานแล้ว แต่${imageUploadError}`)
        navigate("results", `?id=${encodeURIComponent(item.id)}`)
      } else {
        const item = await recordFoundItem({
          category: category as (typeof CATEGORIES)[number],
          color: color as (typeof COLORS)[number],
          location: place as (typeof LOCATIONS)[number],
          foundDate: foundDate ? new Date(foundDate).toISOString() : "",
          description: note,
          image: uploads[0],
        })
        setItems((current) => [item, ...current])
        resetForm()
        setToast("บันทึกสิ่งของที่พบสำเร็จแล้ว")
      }
    } catch (error) {
      setToast(error instanceof Error ? error.message : "บันทึกข้อมูลไม่สำเร็จ")
    } finally {
      setBusy(false)
    }
  }
  const isStaff =
    page === "record" || page === "dashboard" || page === "inventory"
  function upload(files: FileList | null) {
    if (!files) return
    Array.from(files).forEach((file) => {
      if (!["image/jpeg", "image/png"].includes(file.type)) {
        setToast("กรุณาเลือกไฟล์ JPG หรือ PNG")
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setToast("ขนาดรูปภาพต้องไม่เกิน 5 MB")
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        setUploads((old) => [...old, file])
        setUploadPreviews((old) => [...old, reader.result as string])
        setPhotoError(false)
      }
      reader.readAsDataURL(file)
    })
  }
  const titles: Record<Page, string> = {
    home: "หน้าแรก",
    login: "",
    signup: "สมัครสมาชิก",
    report: "แจ้งของหาย",
    results: "ผลการจับคู่",
    record: "บันทึกของที่พบ",
    dashboard: "ภาพรวมระบบ",
    inventory: "รายการของพบทั้งหมด",
  }
  const isSignup = page === "signup"
  function switchAuth(next: "login" | "signup") {
    setPassword("")
    setConfirmPassword("")
    setShowPassword(false)
    setShowConfirmPassword(false)
    setSignupError("")
    navigate(next)
  }
  async function logout() {
    try {
      await signOut()
      setToast("ออกจากระบบแล้ว")
    } catch (error) {
      setToast(error instanceof Error ? error.message : "ออกจากระบบไม่สำเร็จ")
    } finally {
      navigate("login")
    }
  }
  const selectedMatch = matches.find((match) => match.id === detail)
  const weeklyStats = dashboard?.weekly ?? []
  const weeklyMaximum = Math.max(1, ...weeklyStats.flatMap((week) => [week.lost_count, week.found_count]))
  const chartPoints = (key: "lost_count" | "found_count") => weeklyStats
    .map((week, index) => `${30 + index * (315 / Math.max(1, weeklyStats.length - 1))},${170 - (week[key] / weeklyMaximum) * 145}`)
    .join(" ")
  const chartArea = (key: "lost_count" | "found_count") => {
    const points = chartPoints(key)
    if (!points) return ""
    const endX = 30 + Math.max(0, weeklyStats.length - 1) * (315 / Math.max(1, weeklyStats.length - 1))
    return `M30 170 L${points.replace(/ /g, " L")} L${endX} 170 Z`
  }

  return (
    <div
      className={`app-shell ${
        page === "login" || isSignup ? "login-shell" : ""
      } ${page === "home" ? "home-shell" : ""} ${isStaff ? "staff" : ""}`}
    >
      {page === "home" ? (
        <HomePage
          onLogin={() => switchAuth("login")}
          onSignup={() => switchAuth("signup")}
        />
      ) : page === "login" || isSignup ? (
        <>
          <div className="hero">
            <div className="hero-top">
              <span className="mini-brand">
                <span className="brand-dot" /> LOST & FOUND
              </span>
              <button
                className="hero-home-link"
                onClick={() => navigate("home")}
              >
                <Icon name="back" size={14} />
                หน้าแรก
              </button>
            </div>
            <div className="brand-mark">
              <Icon name="bag" size={35} />
              <span className="mark-search">
                <Icon name="search" size={24} />
              </span>
            </div>
            <h1>
              Lost & Found<span className="title-dot">.</span>
            </h1>
            <p>ของหายไม่ต้องกังวล — แจ้งเราไว้</p>
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
          </div>
          <main className="login-main">
            <section className="login-card">
              <div className="welcome-kicker">
                <span /> {isSignup ? "เริ่มต้นเป็นส่วนหนึ่งกับเรา" : "ยินดีต้อนรับกลับมา"}
              </div>
              <h2>{isSignup ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}</h2>
              <p className="login-description">
                {isSignup
                  ? "สร้างบัญชีเพื่อตามหาสิ่งของ และส่งคืนความสบายใจ"
                  : "เริ่มต้นตามหาสิ่งของ และส่งคืนความสบายใจ"}
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault()
                  setBusy(true)
                  setSignupError("")
                  try {
                    if (isSignup) {
                      if (password !== confirmPassword) {
                        throw new Error("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน")
                      }
                      await signUp({ email, password, fullName })
                      switchAuth("login")
                      setToast("สมัครสมาชิกแล้ว โปรดยืนยันอีเมลหากระบบร้องขอ แล้วเข้าสู่ระบบ")
                    } else {
                      const { profile } = await signIn(email, password)
                      resetForm()
                      navigate(profile.role === "staff" ? "record" : "report")
                    }
                  } catch (error) {
                    setSignupError(error instanceof Error ? error.message : "เข้าสู่ระบบไม่สำเร็จ")
                  } finally {
                    setBusy(false)
                  }
                }}
              >
                {isSignup && (
                  <label className="field login-field">
                    <span>
                      ชื่อ–นามสกุล <b className="required">*</b>
                    </span>
                    <div className="input-with-icon">
                      <Icon name="person" size={20} />
                      <input
                        type="text"
                        placeholder="กรอกชื่อและนามสกุลของคุณ"
                        autoComplete="name"
                        required
                        maxLength={100}
                        value={fullName}
                        onChange={(e) => {
                          setFullName(e.target.value)
                          setSignupError("")
                        }}
                      />
                    </div>
                  </label>
                )}
                <label className="field login-field">
                  <span>อีเมล {isSignup && <b className="required">*</b>}</span>
                  <div className="input-with-icon">
                    <Icon name="mail" size={20} />
                    <input
                      type="email"
                      placeholder="example@email.com"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </label>
                <label className="field login-field">
                  <span>
                    รหัสผ่าน {isSignup && <b className="required">*</b>}
                  </span>
                  <div className="input-with-icon">
                    <Icon name="lock" size={20} />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder={
                        isSignup
                          ? "สร้างรหัสผ่านอย่างน้อย 8 ตัวอักษร"
                          : "กรอกรหัสผ่านของคุณ"
                      }
                      autoComplete={
                        isSignup ? "new-password" : "current-password"
                      }
                      required
                      minLength={isSignup ? 8 : undefined}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value)
                        setSignupError("")
                      }}
                    />
                    <button
                      type="button"
                      className="eye-button"
                      aria-label={showPassword ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                      aria-pressed={showPassword}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      <Icon name="eye" size={19} />
                    </button>
                  </div>
                  {isSignup && <small>ใช้รหัสผ่านอย่างน้อย 8 ตัวอักษร</small>}
                </label>
                {isSignup && (
                  <label className="field login-field">
                    <span>
                      ยืนยันรหัสผ่าน <b className="required">*</b>
                    </span>
                    <div className="input-with-icon">
                      <Icon name="lock" size={20} />
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="กรอกรหัสผ่านอีกครั้ง"
                        autoComplete="new-password"
                        required
                        minLength={8}
                        value={confirmPassword}
                        aria-invalid={!!signupError}
                        aria-describedby={
                          signupError ? "signup-error" : undefined
                        }
                        onChange={(e) => {
                          setConfirmPassword(e.target.value)
                          setSignupError("")
                        }}
                      />
                      <button
                        type="button"
                        className="eye-button"
                        aria-label={
                          showConfirmPassword
                            ? "ซ่อนรหัสผ่านยืนยัน"
                            : "แสดงรหัสผ่านยืนยัน"
                        }
                        aria-pressed={showConfirmPassword}
                        onClick={() =>
                          setShowConfirmPassword(!showConfirmPassword)
                        }
                      >
                        <Icon name="eye" size={19} />
                      </button>
                    </div>
                  </label>
                )}
                {signupError && (
                  <p className="signup-error" id="signup-error" role="alert">
                    {signupError}
                  </p>
                )}
                <Button type="submit" className="login-submit" disabled={busy}>
                  {busy ? "กำลังดำเนินการ…" : isSignup ? "สมัครสมาชิก" : "เข้าสู่ระบบ"}
                  <Icon name="arrow" size={18} />
                </Button>
              </form>
              <div className="auth-switch">
                <span>{isSignup ? "มีบัญชีอยู่แล้ว?" : "ยังไม่มีบัญชี?"}</span>
                <button
                  type="button"
                  onClick={() => switchAuth(isSignup ? "login" : "signup")}
                >
                  {isSignup ? "เข้าสู่ระบบ · Log in" : "สมัครสมาชิก · Sign in"}
                  <Icon name="arrow" size={13} />
                </button>
              </div>
              <div className="secure-note">
                <Icon name="shield" size={14} />
                <span>ข้อมูลของคุณปลอดภัย และเป็นส่วนตัว</span>
              </div>
            </section>
            <div className="help-note">
              <span className="help-icon">?</span>
              <p>
                {isSignup ? "หากมีปัญหาในการสมัครสมาชิก" : "หากมีปัญหาในการเข้าสู่ระบบ"}
                <br />
                <button
                  onClick={() =>
                    setToast("ติดต่อเจ้าหน้าที่ที่จุดบริการของหาย อาคาร A ชั้น 1")
                  }
                >
                  กรุณาติดต่อเจ้าหน้าที่ <Icon name="arrow" size={12} />
                </button>
              </p>
            </div>
            <div className={`demo-note ${isSupabaseConfigured ? "backend-ready" : "backend-missing"}`} role="status">
              <span>{isSupabaseConfigured ? "ระบบเชื่อมต่อแล้ว" : "ตั้งค่า Supabase ก่อนเริ่มใช้งาน"}</span>
              <p>
                {isSupabaseConfigured
                  ? isSignup
                    ? "ระบบจะส่งลิงก์ยืนยันไปยังอีเมล หากเปิดการยืนยันอีเมลไว้"
                    : "เข้าสู่ระบบด้วยบัญชีที่ลงทะเบียนไว้ ระบบจะตรวจสอบสิทธิ์จากโปรไฟล์"
                  : "เพิ่ม Project URL และ Publishable key ใน frontend/.env.local แล้วเริ่มเว็บใหม่"}
              </p>
            </div>
          </main>
          <footer className="login-footer">
            <span className="footer-line" />
            <Icon name="bag" size={15} />
            <span>ทุกสิ่งของ มีเจ้าของที่กำลังรอ</span>
            <span className="footer-line" />
          </footer>
        </>
      ) : (
        <>
          <header className={`app-bar ${page === "results" ? "teal-bar" : ""}`}>
            <button
              className="icon-button"
              aria-label={page === "record" ? "เปิดเมนู" : "กลับ"}
              onClick={() =>
                page === "record"
                  ? setDrawer(!drawer)
                  : navigate(
                      page === "dashboard" || page === "inventory"
                        ? "record"
                        : page === "results"
                          ? "report"
                          : "login",
                    )
              }
            >
              <Icon name={page === "record" ? "menu" : "back"} />
            </button>
            <h1>{titles[page]}</h1>
            {page === "dashboard" ? (
              <select
                className="range-select"
                aria-label="ช่วงเวลา"
                value={range}
                onChange={(e) => setRange(e.target.value)}
              >
                <option value="8">8 สัปดาห์ล่าสุด</option>
                <option value="4">4 สัปดาห์ล่าสุด</option>
              </select>
            ) : (
              <button
                className={`icon-button ${refreshing ? "refreshing" : ""}`}
                aria-label={
                  page === "results"
                    ? "รีเฟรชผลการจับคู่"
                    : isStaff
                      ? "ไปหน้าภาพรวม"
                      : "ออกจากระบบ"
                }
                onClick={() => {
                  if (page === "results") {
                    setRefreshing(true)
                    void findMatches(lostItemId)
                      .then((result) => {
                        setMatches(result)
                        setToast("อัปเดตผลการจับคู่แล้ว")
                      })
                      .catch((error) => setToast(error instanceof Error ? error.message : "โหลดผลการจับคู่ไม่สำเร็จ"))
                      .finally(() => setRefreshing(false))
                } else if (isStaff) navigate("dashboard")
                else void logout()
                }}
              >
                <Icon
                  name={
                    page === "results"
                      ? "refresh"
                      : isStaff
                        ? "dashboard"
                        : "person"
                  }
                />
              </button>
            )}
          </header>
          {drawer && (
            <div className="drawer">
              <div className="drawer-title">
                เมนูเจ้าหน้าที่
                <button
                  className="icon-button"
                  aria-label="ปิดเมนู"
                  onClick={() => setDrawer(false)}
                >
                  <Icon name="close" />
                </button>
              </div>
              {(["record", "dashboard", "inventory"] as Page[]).map((p) => (
                <button key={p} onClick={() => navigate(p)}>
                  {titles[p]}
                  <Icon name="arrow" size={16} />
                </button>
              ))}
              <button onClick={() => void logout()}>
                ออกจากระบบ
                <Icon name="logout" size={16} />
              </button>
            </div>
          )}
          {(page === "report" || page === "record") && (
            <>
              {page === "report" ? (
                <div className="page-intro">
                  <div className="eyebrow">เริ่มต้นตามหาสิ่งของของคุณ</div>
                  <p>กรอกข้อมูลเกี่ยวกับสิ่งของที่คุณทำหาย</p>
                  <div className="steps">
                    {["ข้อมูลสิ่งของ", "เวลาล่าสุด", "รายละเอียด", "ส่งรายงาน"].map(
                      (s, i) => (
                        <div
                          className={`step ${
                            i <=
                            (category && color && place
                              ? dateFrom && dateTo
                                ? 2
                                : 1
                              : 0)
                              ? "active"
                              : ""
                          }`}
                          key={s}
                        >
                          <span>{i + 1}</span>
                          <small>{s}</small>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : (
                <div className="staff-identity">
                  <span>
                    <Icon name="person" size={17} />
                    กำลังบันทึกโดย: เจ้าหน้าที่
                  </span>
                  <button onClick={() => void logout()}>ออกจากระบบ</button>
                </div>
              )}
              <form onSubmit={submit} className="report-form">
                {page === "record" && (
                  <Card title="รูปภาพสิ่งของ *" icon="camera">
                    <p className="photo-required">จำเป็นต้องอัปโหลดอย่างน้อย 1 รูป</p>
                    {uploadZone()}
                  </Card>
                )}
                <Card title="ข้อมูลสิ่งของ" icon="bag">
                  <SelectField
                    label="หมวดหมู่สิ่งของ"
                    options={categories}
                    value={category}
                    onChange={setCategory}
                    helper="เลือกประเภทที่ใกล้เคียงที่สุด"
                  />
                  <SelectField
                    label="สี"
                    options={colors}
                    value={color}
                    onChange={setColor}
                  />
                  <SelectField
                    label={page === "record" ? "สถานที่ที่พบ" : "สถานที่"}
                    options={locations}
                    value={place}
                    onChange={setPlace}
                    helper={
                      page === "report" ? "สถานที่ที่คุณคิดว่าทำหายไว้" : undefined
                    }
                  />
                </Card>
                <Card
                  title={page === "report" ? "ช่วงเวลาที่คาดว่าหาย" : "วันเวลาที่พบ"}
                  icon="clock"
                >
                  {page === "report" ? (
                    <div className="form-grid">
                      <label className="field">
                        <span>ตั้งแต่ <b className="required">*</b></span>
                        <input type="datetime-local" required value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                      </label>
                      <label className="field">
                        <span>ถึง <b className="required">*</b></span>
                        <input type="datetime-local" required min={dateFrom || undefined} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                      </label>
                    </div>
                  ) : (
                    <label className="field">
                      <span>วันที่และเวลาที่พบ <b className="required">*</b></span>
                      <input type="datetime-local" required value={foundDate} onChange={(e) => setFoundDate(e.target.value)} />
                    </label>
                  )}
                </Card>
                <Card title="รายละเอียดเพิ่มเติม" icon="list">
                  <span className="optional">ไม่บังคับ</span>
                  <label className="field">
                    <span>คำอธิบายสิ่งของ</span>
                    <textarea
                      rows={3}
                      placeholder="เช่น ยี่ห้อ ลักษณะเด่น หรือสิ่งของที่อยู่ด้านใน"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                    />
                  </label>
                  {page === "report" && (
                    <>
                      {uploadZone()}
                      <p className="helper">ไม่จำเป็นต้องใส่รูปก็ได้</p>
                    </>
                  )}
                </Card>
                <div className="bottom-action">
                  <Button
                    type="submit"
                    disabled={busy}
                    icon={page === "report" ? "send" : "save"}
                  >
                    {page === "report" ? "ส่งรายงาน" : "บันทึกสิ่งของที่พบ"}
                  </Button>
                </div>
              </form>
            </>
          )}
          {page === "results" && (
            <>
              <div className="results-banner">
                <div>
                  <p>พบรายการที่อาจตรงกัน</p>
                  <h2>
                    {matches.length} <span>รายการ</span>
                  </h2>
                  <small>เรียงตามความใกล้เคียงกับสิ่งของของคุณ</small>
                </div>
                <Icon name="check" size={52} />
              </div>
              <div className="result-content">
                <p className="eyebrow">สิ่งของที่คุณแจ้งหาย</p>
                <div className="report-chip">
                  <Icon name="bag" size={18} />
                  {lostReport?.category ?? category}
                  <span>·</span>
                  <i className="color-dot" />
                  {lostReport?.color ?? color}
                  <span>·</span>
                  <Icon name="pin" size={16} />
                  {lostReport?.location ?? place}
                </div>
                {matches.length ? (
                  <>
                    <div className="list-heading">
                      <h2>รายการที่อาจเป็นของคุณ</h2>
                      <span>{matches.length} รายการ</span>
                    </div>
                    {matches.map((match) => (
                      <article className="match-card" key={match.id}>
                        <div className="match-photo">
                          <img
                            src={match.image_url}
                            alt={`รูป${match.category}ที่พบ`}
                          />
                          <span
                            className="match-badge"
                          >
                            <Icon name="check" size={15} />
                            ตรงกัน {match.percentage}%
                          </span>
                        </div>
                        <div className="match-body">
                          <h3>
                            <Icon name="bag" size={21} />
                            {match.category}
                          </h3>
                          <p>
                            <Icon name="pin" size={16} />
                            {match.location}
                          </p>
                          <p>
                            <Icon name="calendar" size={16} />
                            {new Date(match.found_date).toLocaleString("th-TH")}
                          </p>
                          <p>
                            <i className="color-dot" />
                            {match.color}
                          </p>
                          <div className="match-note">
                            {match.description || "ไม่มีรายละเอียดเพิ่มเติม"}
                          </div>
                          <div className="match-actions">
                            <button
                              className="text-button"
                              onClick={() => setDetail(match.id)}
                            >
                              ดูรายละเอียด
                              <Icon name="arrow" size={16} />
                            </button>
                            <Button
                              onClick={() => setClaim(match.id)}
                              disabled={claimed.includes(match.id)}
                            >
                              {claimed.includes(match.id) ? "ส่งคำขอแล้ว" : "นี่คือของฉัน"}
                            </Button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">
                      <Icon name="search" size={58} />
                    </div>
                    <h2>ยังไม่พบรายการที่ตรงกัน</h2>
                    <p>ระบบจะแจ้งเมื่อมีของที่ตรงกับที่คุณแจ้งไว้</p>
                    <Button secondary onClick={() => navigate("report")}>
                      กลับหน้าหลัก
                    </Button>
                  </div>
                )}
              </div>
            </>
          )}
          {page === "dashboard" && (
            <main className="dashboard-content">
              <div className="dashboard-heading">
                <p className="eyebrow">ภาพรวมการดูแลสิ่งของ</p>
                <p>{range} สัปดาห์ล่าสุด</p>
              </div>
              <div className="stats-grid">
                {[
                  {
                    icon: "search",
                    n: dashboard?.summary?.total_lost ?? 0,
                    label: "รายการของหาย",
                    theme: "indigo",
                  },
                  {
                    icon: "bag",
                    n: dashboard?.summary?.total_found ?? 0,
                    label: "รายการของพบ",
                    theme: "teal",
                  },
                  {
                    icon: "check",
                    n: dashboard?.summary?.matched ?? 0,
                    label: "จับคู่สำเร็จ",
                    theme: "green",
                  },
                  {
                    icon: "clock",
                    n: dashboard?.summary?.pending ?? 0,
                    label: "รอดำเนินการ",
                    theme: "amber",
                  },
                ].map((stat) => (
                  <div className={`stat-card ${stat.theme}`} key={stat.label}>
                    <div className="stat-icon">
                      <Icon name={stat.icon as IconName} />
                    </div>
                    <strong>{stat.n}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
              <Card>
                <div className="chart-heading">
                  <h3>แนวโน้มรายสัปดาห์</h3>
                  <Icon name="calendar" size={19} />
                </div>
                <div className="chart-legend">
                  <span>
                    <i className="legend-dot indigo-dot" />
                    แจ้งหาย
                  </span>
                  <span>
                    <i className="legend-dot teal-dot" />
                    ของพบ
                  </span>
                </div>
                <svg
                  className="chart"
                  viewBox="0 0 360 205"
                  role="img"
                  aria-label={`กราฟรายการแจ้งหายและของพบ ${range} สัปดาห์ล่าสุด`}
                >
                  <defs>
                    <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3F51B5" stopOpacity=".12" />
                      <stop offset="100%" stopColor="#3F51B5" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  {[30, 70, 110, 150].map((y, i) => (
                    <g key={y}>
                      <line
                        x1="30"
                        y1={y}
                        x2="350"
                        y2={y}
                        stroke="#eeeeee"
                        strokeDasharray="4 4"
                      />
                      <text x="4" y={y + 4}>
                        {30 - i * 10}
                      </text>
                    </g>
                  ))}
                  <path
                    d={chartArea("lost_count")}
                    fill="url(#chart-fill)"
                  />
                  <polyline
                    points={chartPoints("lost_count")}
                    fill="none"
                    stroke="#3F51B5"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                  <polyline
                    points={chartPoints("found_count")}
                    fill="none"
                    stroke="#009688"
                    strokeWidth="3"
                    strokeLinejoin="round"
                  />
                  {weeklyStats.map((week, i) => (
                    <text
                      key={week.week_start}
                      x={30 + (i * 315) / Math.max(1, weeklyStats.length - 1)}
                      y="195"
                      textAnchor="middle"
                    >
                      {new Date(`${week.week_start}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}
                    </text>
                  ))}
                </svg>
              </Card>
              <Card>
                <p className="quick-title">เมนูด่วน</p>
                <button
                  className="list-tile"
                  onClick={() => {
                    resetForm()
                    navigate("record")
                  }}
                >
                  <Icon name="save" />
                  <span>บันทึกของที่พบใหม่</span>
                  <Icon name="arrow" size={18} />
                </button>
                <button
                  className="list-tile"
                  onClick={() => navigate("inventory")}
                >
                  <Icon name="list" />
                  <span>รายการของพบทั้งหมด</span>
                  <Icon name="arrow" size={18} />
                </button>
              </Card>
            </main>
          )}
          {page === "inventory" && (
            <main className="dashboard-content">
              <p className="eyebrow">
                รายการที่บันทึกในอุปกรณ์นี้ · {items.length} รายการ
              </p>
              {items.length ? (
                items.map((item, i) => (
                  <article className="match-card" key={i}>
                    <div className="match-photo">
                    <img src={item.image_url} alt={item.category} />
                    </div>
                    <div className="match-body">
                      <h3>
                        {item.category} · {item.color}
                      </h3>
                      <p>
                        <Icon name="pin" size={16} />
                        {item.location}
                      </p>
                      <p>
                        <Icon name="calendar" size={16} />
                        {new Date(item.found_date).toLocaleString("th-TH")}
                      </p>
                      {item.description && <p>{item.description}</p>}
                    </div>
                  </article>
                ))
              ) : (
                <div className="empty-state">
                  <Icon name="bag" size={55} />
                  <h2>ยังไม่มีรายการที่บันทึก</h2>
                  <p>เริ่มบันทึกสิ่งของที่พบ เพื่อช่วยให้เจ้าของตามหาได้</p>
                  <Button icon="plus" onClick={() => navigate("record")}>
                    บันทึกของที่พบใหม่
                  </Button>
                </div>
              )}
            </main>
          )}
        </>
      )}
      {(detail !== null || claim !== null) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setDetail(null)
            setClaim(null)
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={detail !== null ? "รายละเอียดสิ่งของ" : "ยืนยันสิ่งของของคุณ"}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="ปิด"
              onClick={() => {
                setDetail(null)
                setClaim(null)
              }}
            >
              <Icon name="close" />
            </button>
            {detail !== null && selectedMatch ? (
              <>
                <img src={selectedMatch.image_url} alt={`${selectedMatch.category}ที่พบ`} />
                <h2>รายละเอียดสิ่งของที่พบ</h2>
                <p>
                  {selectedMatch.category} · {selectedMatch.color} · {selectedMatch.location}
                </p>
                <p>พบเมื่อ {new Date(selectedMatch.found_date).toLocaleString("th-TH")}</p>
                {selectedMatch.description && <p>{selectedMatch.description}</p>}
                <div className="modal-info">
                  <Icon name="pin" />
                  รับสิ่งของได้ที่จุดบริการของหาย
                </div>
                <Button
                  onClick={() => {
                    setClaim(selectedMatch.id)
                    setDetail(null)
                  }}
                >
                  นี่คือของฉัน
                </Button>
              </>
            ) : (
              <>
                <div className="claim-icon">
                  <Icon name="shield" size={40} />
                </div>
                <h2>นี่คือสิ่งของของคุณใช่ไหม?</h2>
                <p>
                  ส่งคำขอให้เจ้าหน้าที่ตรวจสอบ
                  และเตรียมหลักฐานแสดงความเป็นเจ้าของเมื่อรับสิ่งของ
                </p>
                <Button
                  icon="check"
                  disabled={busy || !claim || !lostItemId}
                  onClick={async () => {
                    if (!claim || !lostItemId) return
                    setBusy(true)
                    try {
                      await requestMatchClaim(lostItemId, claim)
                      setClaimed((old) => [...new Set([...old, claim])])
                      setClaim(null)
                      setToast("ส่งคำขอให้เจ้าหน้าที่ตรวจสอบแล้ว")
                    } catch (error) {
                      setToast(error instanceof Error ? error.message : "ส่งคำขอไม่สำเร็จ")
                    } finally {
                      setBusy(false)
                    }
                  }}
                >
                  ยืนยันว่าเป็นของฉัน
                </Button>
                <Button secondary onClick={() => setClaim(null)}>
                  กลับไปตรวจสอบ
                </Button>
              </>
            )}
          </section>
        </div>
      )}
      {toast && (
        <div className="snackbar" role="status">
          <Icon name="check" size={20} />
          {toast}
        </div>
      )}
    </div>
  )

  function uploadZone() {
    return (
      <div id="upload-zone">
        <label
          className={`upload-zone ${page === "record" ? "large" : ""} ${
            photoError ? "upload-error" : ""
          }`}
        >
          <input
            type="file"
            accept="image/jpeg,image/png"
            multiple
            onChange={(e) => {
              upload(e.target.files)
              e.target.value = ""
            }}
          />
          <Icon name="camera" size={page === "record" ? 40 : 28} />
          <strong>
            {page === "record" ? "แตะเพื่อถ่ายรูปหรืออัปโหลด" : "แตะเพื่อเพิ่มรูปภาพ"}
          </strong>
          <small>รองรับ JPG, PNG · สูงสุด 5 MB ต่อรูป</small>
        </label>
        {photoError && (
          <p className="photo-required" role="alert">
            กรุณาอัปโหลดรูปภาพอย่างน้อย 1 รูป
          </p>
        )}
        {uploads.length > 0 && (
          <div className="upload-previews">
            {uploadPreviews.map((src, i) => (
              <div key={i}>
                <img src={src} alt={`รูปสิ่งของ ${i + 1}`} />
                <button
                  type="button"
                  aria-label={`ลบรูปที่ ${i + 1}`}
                  onClick={() =>
                    { setUploads((old) => old.filter((_, index) => index !== i)); setUploadPreviews((old) => old.filter((_, index) => index !== i)) }
                  }
                >
                  <Icon name="close" size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }
}
