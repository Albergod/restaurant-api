"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { CheckCircle2, Circle, ChevronRight, Loader2 } from "lucide-react"

/** Checklist de onboarding (menú → mesas → QR) para cuentas nuevas/trial. */
export default function OnboardingChecklist({ displayState, demo = false }) {
  const router = useRouter()
  const [checks, setChecks] = useState(null)

  useEffect(() => {
    if (!["registered", "trialing"].includes(displayState)) return
    let cancelled = false
    Promise.all([
      apiFetch("/api/menu/").catch(() => []),
      apiFetch("/api/tables/").catch(() => []),
    ]).then(([menu, tables]) => {
      if (cancelled) return
      const products = (Array.isArray(menu) ? menu : []).flatMap((c) => c.products || [])
      setChecks({
        hasProducts: products.length > 0,
        hasTables: Array.isArray(tables) && tables.length > 0,
      })
    })
    return () => {
      cancelled = true
    }
  }, [displayState])

  if (demo || !["registered", "trialing"].includes(displayState)) return null

  const steps = [
    {
      done: displayState !== "registered",
      title: displayState === "registered" ? "Activa tu prueba de 14 días" : "Prueba activada",
      desc: "Sin tarjeta. El contador empieza cuando tú decides.",
      href: null,
    },
    {
      done: !!checks?.hasProducts,
      title: "Sube tu menú",
      desc: "Crea una categoría y tu primer plato con foto y precio.",
      href: "/admin/menu",
    },
    {
      done: !!checks?.hasTables,
      title: "Crea tus mesas y su QR",
      desc: "Cada mesa con su QR imprimible para que pidan desde el celular.",
      href: "/admin/tables",
    },
  ]
  const doneCount = steps.filter((s) => s.done).length

  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 mb-4">
      <div className="flex items-center justify-between mb-1">
        <h2 className="font-bold text-amber-900">Pon tu restaurante a vender</h2>
        <span className="text-xs font-semibold text-amber-700">
          {doneCount}/{steps.length}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-amber-100 mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all"
          style={{ width: `${(doneCount / steps.length) * 100}%` }}
        />
      </div>
      <div className="space-y-1">
        {steps.map((s) => (
          <div key={s.title} className="flex items-center gap-3 rounded-xl px-2 py-2">
            {s.done ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
            ) : checks === null ? (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-amber-400" />
            ) : (
              <Circle className="h-5 w-5 shrink-0 text-amber-400" />
            )}
            <div className="flex-1">
              <p className={`text-sm font-semibold ${s.done ? "text-gray-400 line-through" : "text-gray-900"}`}>
                {s.title}
              </p>
              {!s.done && <p className="text-xs text-gray-500">{s.desc}</p>}
            </div>
            {!s.done && s.href && (
              <button
                onClick={() => router.push(s.href)}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600"
              >
                Ir <ChevronRight className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
