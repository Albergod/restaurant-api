"use client"

import { useState, useEffect } from "react"
import { useRouter, usePathname } from "next/navigation"
import { billingApi, getRole } from "@/lib/api"
import { Sparkles, Clock, AlertTriangle, ArrowRight, X } from "lucide-react"

function daysLeft(iso) {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.max(0, Math.ceil(ms / 86400000))
}

export default function TrialBanner() {
  const router = useRouter()
  const pathname = usePathname()
  const [status, setStatus] = useState(null)
  const [activating, setActivating] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (getRole() !== "admin") return
    billingApi.status().then(setStatus).catch(() => {})
  }, [pathname])

  if (!status || dismissed) return null

  // Modo demo: el explorador no es un cliente. Nada de CTAs de compra,
  // solo un marco claro y vuelta a la demo pública.
  if (status.restaurant_slug === "demo") {
    return (
      <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm">
        <Sparkles className="h-5 w-5 shrink-0 text-sky-600" />
        <p className="flex-1 text-sky-900">
          <strong>Estás explorando la demo.</strong> Todo es ficticio: pide,
          confirma y juega sin miedo, nada es real.
        </p>
        <button
          onClick={() => router.push("/demo")}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700"
        >
          Volver a la demo <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  const state = status.display_state || status.subscription_status

  // registered: sin prueba activada → CTA grande
  if (state === "registered") {
    return (
      <div className="mx-4 mt-4 rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-5 text-white shadow-lg">
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 shrink-0" />
          <div className="flex-1">
            <p className="font-bold">Activa tu prueba gratuita de 14 días</p>
            <p className="text-sm text-white/85">Sin tarjeta. Empieza a usar todo hoy mismo.</p>
          </div>
          <button
            disabled={activating}
            onClick={async () => {
              setActivating(true)
              try {
                await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/restaurants/${status.restaurant_id}/trial`, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
                }).then((r) => {
                  if (!r.ok) throw new Error("No se pudo activar")
                  return r.json()
                })
                const fresh = await billingApi.status()
                setStatus(fresh)
              } catch {
                router.push("/admin/billing")
              } finally {
                setActivating(false)
              }
            }}
            className="shrink-0 rounded-xl bg-white px-5 py-2.5 text-sm font-bold text-orange-600 hover:bg-orange-50 disabled:opacity-60"
          >
            {activating ? "Activando…" : "Activar prueba"}
          </button>
        </div>
      </div>
    )
  }

  // trialing con fecha: cuenta regresiva discreta
  if (state === "trialing" && status.trial_ends_at) {
    const left = daysLeft(status.trial_ends_at)
    return (
      <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
        <Clock className="h-5 w-5 shrink-0 text-amber-600" />
        <p className="flex-1 text-amber-900">
          Tu prueba termina en <strong>{left} {left === 1 ? "día" : "días"}</strong>. Elige un plan para no interrumpir tu restaurante.
        </p>
        <button
          onClick={() => router.push("/admin/billing")}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600"
        >
          Ver planes <ArrowRight className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setDismissed(true)} aria-label="Descartar">
          <X className="h-4 w-4 text-amber-400" />
        </button>
      </div>
    )
  }

  // mora dentro de gracia: aviso ámbar (sigue operando)
  if (state === "past_due") {
    return (
      <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
        <Clock className="h-5 w-5 shrink-0 text-amber-600" />
        <p className="flex-1 text-amber-900">
          <strong>Pago pendiente.</strong> Sigues operando por gracia, renueva para no pausar tu restaurante.
        </p>
        <button
          onClick={() => router.push("/admin/billing")}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600"
        >
          Renovar <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  // vencido / suspendido: paywall (los datos se conservan)
  if (["expired", "suspended", "cancelled"].includes(state)) {
    return (
      <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm">
        <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
        <p className="flex-1 text-red-900">
          <strong>Suscripción vencida.</strong> Tus datos están a salvo, pero los pedidos y el menú están pausados.
        </p>
        <button
          onClick={() => router.push("/admin/billing")}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-red-600 px-4 py-2 text-xs font-bold text-white hover:bg-red-700"
        >
          Renovar ahora <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  return null
}
