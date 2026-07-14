"use client"

import { Check, Clock, Package, CookingPot, Truck, Home } from "lucide-react"

const STATUS_ORDER = ["pending", "confirmed", "preparing", "ready", "delivered"]

const STATUS_LABELS = {
  pending: "Pendiente", confirmed: "Confirmado", preparing: "En preparación",
  ready: "Listo", delivered: "Entregado", cancelled: "Cancelado",
}

const STATUS_ICONS = {
  pending: Clock, confirmed: Package, preparing: CookingPot, ready: Truck, delivered: Home,
}

export default function StatusStepper({ status }) {
  const currentIndex = STATUS_ORDER.indexOf(status)

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="relative">
        {STATUS_ORDER.map((s, i) => {
          const Icon = STATUS_ICONS[s]
          const isDone = i <= currentIndex
          const isCurrent = i === currentIndex
          const isLast = i === STATUS_ORDER.length - 1
          return (
            <div key={s} className="flex items-start gap-3">
              <div className="flex flex-col items-center">
                <div className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-500 ${
                  isDone ? "bg-amber-500 text-white shadow-md shadow-amber-200" : "border-2 border-gray-200 bg-white text-gray-300"
                } ${isCurrent ? "scale-110 ring-4 ring-amber-100" : ""}`}>
                  {isDone ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                {!isLast && (
                  <div className={`my-1 w-0.5 flex-1 ${isDone ? "bg-amber-300" : "bg-gray-200"}`} style={{ minHeight: "24px" }} />
                )}
              </div>
              <div className={`pb-6 ${isLast ? "pb-0" : ""}`}>
                <p className={`text-sm font-medium ${isDone ? "text-gray-900" : "text-gray-400"}`}>{STATUS_LABELS[s]}</p>
                {isCurrent && status !== "delivered" && (
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-amber-600">
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />Procesando...
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { STATUS_LABELS }
