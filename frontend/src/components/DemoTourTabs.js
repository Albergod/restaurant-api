"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiFetch, billingApi, logout } from "@/lib/api"
import {
  LayoutDashboard,
  UtensilsCrossed,
  Users,
  CookingPot,
  RotateCcw,
  LogOut,
  Loader2,
  Sparkles,
  ArrowLeft,
} from "lucide-react"

const TOUR_FLAG = "demo_tour"
const QR_CACHE = "demo_tour_qr"

export function enableDemoTour() {
  try { localStorage.setItem(TOUR_FLAG, "1") } catch { /* noop */ }
}

export function disableDemoTour() {
  try {
    localStorage.removeItem(TOUR_FLAG)
    localStorage.removeItem(QR_CACHE)
  } catch { /* noop */ }
}

export function isDemoTour() {
  try { return localStorage.getItem(TOUR_FLAG) === "1" } catch { return false }
}

async function resolveTableQr() {
  try {
    const cached = localStorage.getItem(QR_CACHE)
    if (cached) return cached
  } catch { /* noop */ }
  const overview = await apiFetch("/api/restaurants/demo/overview")
  if (overview?.table_qr) {
    try { localStorage.setItem(QR_CACHE, overview.table_qr) } catch { /* noop */ }
    return overview.table_qr
  }
  return null
}

/** Barra del tour demo: Panel → Cliente → Mesero → Cocina. Solo visible en modo demo. */
export default function DemoTourTabs({ current }) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const [tableQr, setTableQr] = useState(null)
  const [resetting, setResetting] = useState(false)
  const [resolvingQr, setResolvingQr] = useState(false)

  useEffect(() => {
    if (!isDemoTour()) return
    let cancelled = false
    billingApi.status()
      .then((s) => {
        if (cancelled) return
        if (s?.restaurant_slug === "demo") {
          setVisible(true)
          resolveTableQr().then((qr) => { if (!cancelled) setTableQr(qr) }).catch(() => {})
        } else {
          disableDemoTour()
        }
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  if (!visible) return null

  const tabs = [
    { key: "panel", label: "Panel", icon: LayoutDashboard, href: "/admin" },
    { key: "cliente", label: "Cliente", icon: UtensilsCrossed, href: null },
    { key: "mesero", label: "Mesero", icon: Users, href: "/waiter" },
    { key: "cocina", label: "Cocina", icon: CookingPot, href: "/kitchen" },
  ]

  // El QR se resuelve por API: nunca se navega sin él (el fallback a /demo
  // solo confundiría). El botón espera con spinner si aún se está resolviendo.
  async function goCliente() {
    if (resolvingQr) return
    const qr = tableQr || await (async () => {
      setResolvingQr(true)
      try {
        const resolved = await resolveTableQr()
        if (resolved) setTableQr(resolved)
        return resolved
      } catch {
        return null
      } finally {
        setResolvingQr(false)
      }
    })()
    if (qr) router.push(`/menu/${qr}?tour=1`)
  }

  async function handleReset() {
    if (!window.confirm("¿Restaurar la demo a su estado original? Se borran pedidos y todo lo creado por visitantes (platos, mesas, usuarios). La carta vuelve a la de ejemplo.")) return
    setResetting(true)
    try {
      await apiFetch("/api/restaurants/demo/reset", { method: "POST" })
      // El QR cacheado podría no existir tras el reset: limpiarlo obliga a
      // resolverlo de nuevo y la pestaña Cliente nunca apunta a un QR muerto.
      try { localStorage.removeItem(QR_CACHE) } catch { /* noop */ }
      window.location.reload()
    } catch (e) {
      alert(e instanceof Error ? e.message : "No se pudo reiniciar la demo")
    } finally {
      setResetting(false)
    }
  }

  function handleExit() {
    disableDemoTour()
    logout()
    router.replace("/demo")
  }

  return (
    <div className="sticky top-0 z-50 border-b border-amber-500/30 bg-gray-900 text-white shadow-lg">
      <div className="mx-auto flex max-w-6xl items-center gap-1 sm:gap-1.5 overflow-x-auto px-2 sm:px-4 py-2 sm:py-3">
        <span className="mr-1 hidden shrink-0 items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-3.5 py-1.5 text-xs font-bold text-amber-300 sm:inline-flex">
          <Sparkles className="h-4 w-4" /> TOUR DEMO
        </span>
        {tabs.map((t) => {
          const active = current === t.key
          const busy = t.key === "cliente" && resolvingQr
          return (
            <button
              key={t.key}
              disabled={busy}
              onClick={() => {
                if (active || busy) return
                if (t.href) router.push(t.href)
                else goCliente()
              }}
              title={t.key === "cliente" && !tableQr ? "Cargando vista cliente…" : undefined}
              className={`inline-flex shrink-0 items-center gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold transition-colors disabled:opacity-70 ${
                active ? "bg-amber-500 text-white" : "text-gray-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {busy ? <Loader2 className="h-4 w-4 sm:h-[18px] sm:w-[18px] animate-spin" /> : <t.icon className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />} {t.label}
            </button>
          )
        })}
        <span className="flex-1" />
        <button
          onClick={handleReset}
          disabled={resetting}
          title="Borrar pedidos de prueba"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl px-2.5 sm:px-3.5 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold text-gray-300 hover:bg-white/10 hover:text-white disabled:opacity-60"
        >
          {resetting ? <Loader2 className="h-4 w-4 sm:h-[18px] sm:w-[18px] animate-spin" /> : <RotateCcw className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />}
          <span className="hidden sm:inline">Reiniciar</span>
        </button>
        <button
          onClick={handleExit}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-xl bg-white/10 px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-white/20"
        >
          <LogOut className="h-4 w-4 sm:h-[18px] sm:w-[18px]" /> Salir
        </button>
      </div>
    </div>
  )
}

/** Mini-barra en la vista cliente (?tour=1) para volver al tour. */
export function DemoTourReturn() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [show] = useState(
    () => searchParams.get("tour") === "1" && isDemoTour()
  )

  if (!show) return null

  return (
    <div className="sticky top-0 z-50 flex items-center gap-2 bg-gray-900 px-4 py-2 text-white">
      <Sparkles className="h-4 w-4 shrink-0 text-amber-400" />
      <p className="flex-1 text-xs font-semibold text-gray-200">
        Vista cliente · así lo verían tus comensales
      </p>
      <button
        onClick={() => router.push("/admin")}
        className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold hover:bg-amber-600"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Volver al tour
      </button>
    </div>
  )
}
