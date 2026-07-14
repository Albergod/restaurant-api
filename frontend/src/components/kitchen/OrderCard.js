"use client"

import { Timer, ArrowRight, CheckCircle2, Clock, CookingPot } from "lucide-react"

const STATUS_LABELS = {
  pending: "Pendiente", confirmed: "Confirmado", preparing: "En preparación",
  ready: "Listo", delivered: "Entregado", cancelled: "Cancelado",
}

function getTimeAgo(dateString) {
  if (!dateString) return ""
  const diff = Date.now() - new Date(dateString).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "recién"
  if (mins < 60) return `hace ${mins} min`
  const hrs = Math.floor(mins / 60)
  return `hace ${hrs}h ${mins % 60}m`
}

export default function KitchenOrderCard({ order, onUpdateStatus }) {
  const isConfirmed = order.status === "confirmed"
  const borderColor = isConfirmed ? "border-l-amber-500" : "border-l-orange-500"
  const badgeColor = isConfirmed ? "bg-blue-100 text-blue-700" : "bg-orange-100 text-orange-700"

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md">
      <div className={`border-l-4 ${borderColor} p-4`}>
        <div className="mb-3 flex items-start justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">Pedido #{order.id}</p>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
              <span>Mesa {order.table_number ? `#${order.table_number}` : "—"}</span>
              <span>·</span>
              <span className="flex items-center gap-1"><Timer className="h-3 w-3" />{getTimeAgo(order.created_at)}</span>
            </div>
          </div>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badgeColor}`}>
            {STATUS_LABELS[order.status]}
          </span>
        </div>
        </div>

        <div className="mb-3 space-y-1">
          {(order.items || []).map((item, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium text-gray-900">{item.quantity}x</span>{" "}
              <span className="text-gray-600">{item.product_name}</span>
              {item.notes && <p className="ml-4 text-xs italic text-gray-400">Nota: {item.notes}</p>}
            </div>
          ))}
        </div>

        {isConfirmed && (
          <button onClick={() => onUpdateStatus(order.id, "preparing")}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600">
            <ArrowRight className="h-4 w-4" />Iniciar preparación
          </button>
        )}
        {order.status === "preparing" && (
          <button onClick={() => onUpdateStatus(order.id, "ready")}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600">
            <CheckCircle2 className="h-4 w-4" />Marcar como listo
          </button>
        )}
      </div>
    </div>
  )
}
