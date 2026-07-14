"use client"

import { useRouter } from "next/navigation"
import { Clock, Package, ChefHat, CheckCircle2, ClipboardList, XCircle, CheckCircle2 as CheckCircle, MessageSquare } from "lucide-react"

const STATUS_LABELS = {
  pending: "Pendiente", confirmed: "Confirmado", preparing: "En preparación",
  ready: "Listo", delivered: "Entregado", cancelled: "Cancelado",
}

const STATUS_STYLES = {
  pending: "bg-yellow-100 text-yellow-800", confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800", ready: "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-600", cancelled: "bg-red-100 text-red-700",
}

const STATUS_ICONS = {
  pending: Clock, confirmed: Package, preparing: ChefHat,
  ready: CheckCircle2, delivered: ClipboardList, cancelled: XCircle,
}

const BORDER_COLORS = {
  pending: "border-l-yellow-400", confirmed: "border-l-blue-400",
  preparing: "border-l-orange-400", ready: "border-l-green-400",
}

export default function OrderCard({ order, onUpdateStatus }) {
  const router = useRouter()
  const StatusIcon = STATUS_ICONS[order.status] || Clock
  const borderColor = BORDER_COLORS[order.status] || "border-l-gray-200"

  return (
    <div className={`rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md border-l-4 ${borderColor}`}>
      <div className="p-4">
        <div className="mb-2 flex items-start justify-between">
          <div>
            <p className="text-base font-bold text-gray-900">Pedido #{order.id}</p>
            <p className="text-xs text-gray-500">Mesa {order.table_number ? `#${order.table_number}` : "—"}</p>
          </div>
          <div className="flex items-center gap-2">
            {order.has_active_chat && (
              <button onClick={() => router.push(`/chat/${order.active_chat_session_id}`)}
                className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-blue-50 text-blue-600 transition-colors hover:bg-blue-100"
                title="Chat con la mesa">
                <MessageSquare className="h-3.5 w-3.5" />
                {order.unread_count > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {order.unread_count > 9 ? '9+' : order.unread_count}
                  </span>
                )}
              </button>
            )}
            <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[order.status] || "bg-gray-100 text-gray-600"}`}>
              <StatusIcon className="h-3 w-3" />{STATUS_LABELS[order.status] || order.status}
            </span>
          </div>
        </div>

        <div className="mb-3 space-y-1">
          {(order.items || []).map((item, i) => (
            <p key={i} className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">{item.quantity}x</span> {item.product_name}
              <span className="ml-2 text-gray-400">${Number(item.unit_price).toFixed(2)}</span>
            </p>
          ))}
        </div>

        <div className="flex gap-2">
          {order.status === "pending" && (
            <>
              <button onClick={() => onUpdateStatus(order.id, "confirmed")}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600">
                <CheckCircle className="h-4 w-4" />Confirmar
              </button>
              <button onClick={() => onUpdateStatus(order.id, "cancelled")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600">
                <XCircle className="h-4 w-4" />Cancelar
              </button>
            </>
          )}
          {order.status === "ready" && (
            <button onClick={() => onUpdateStatus(order.id, "delivered")}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600">
              <CheckCircle className="h-4 w-4" />Entregar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
