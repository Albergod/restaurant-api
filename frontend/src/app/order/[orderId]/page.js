"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import { UtensilsCrossed, AlertCircle, MessageSquare, ChevronLeft, Package, Home } from "lucide-react"
import StatusStepper, { STATUS_LABELS } from "@/components/order/StatusStepper"
import OrderItems from "@/components/order/OrderItems"

export default function OrderPage() {
  const params = useParams()
  const router = useRouter()
  const orderId = params.orderId
  const [order, setOrder] = useState(null)
  const [tableNumber, setTableNumber] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [openingChat, setOpeningChat] = useState(false)

  useEffect(() => {
    let cancelled = false
    let interval
    let failCount = 0

    async function fetchOrder() {
      try {
        const data = await apiFetch(`/api/orders/${orderId}`)
        if (cancelled) return
        setOrder(data)
        setError(null)
        failCount = 0
        if (data.status === "delivered" || data.status === "cancelled") clearInterval(interval)
        if (data.table_qr) {
          apiFetch(`/api/menu/table-by-qr/${data.table_qr}`)
            .then(t => setTableNumber(t.number))
            .catch(() => {})
        }
      } catch (e) {
        failCount++
        if (failCount >= 3 && !cancelled) setError("Error al cargar el pedido")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchOrder()
    interval = setInterval(fetchOrder, 8000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [orderId])

  async function openChat() {
    setOpeningChat(true)
    try {
      const session = await apiFetch(`/api/chat/sessions/${order.table_qr}`, { method: "POST" })
      router.push(`/chat/${session.id}`)
    } catch (e) {
      setError("Error al abrir el chat")
    } finally {
      setOpeningChat(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-40 rounded-lg bg-gray-100" />
          <div className="h-48 rounded-xl bg-gray-100" />
          <div className="h-32 rounded-xl bg-gray-100" />
        </div>
      </div>
    )
  }

  if (error || !order) {
    return (
      <div className="mx-auto max-w-lg p-4">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
          <p className="mb-4 text-sm font-medium text-red-600">{error || "Pedido no encontrado"}</p>
          <button onClick={() => router.back()}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
            <ChevronLeft className="h-4 w-4" />Volver
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-lg bg-[#fafafa]">
      <header className="border-b border-gray-200 bg-white px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500">
              <UtensilsCrossed className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Pedido #{order.id}</h1>
              <p className="text-xs text-gray-500">
                {tableNumber ? `Mesa #${tableNumber}` : order.table_id ? `Mesa #${order.table_id}` : "Para llevar"}
              </p>
            </div>
          </div>
          <div className={`rounded-full px-3 py-1 text-xs font-medium ${order.status !== "cancelled" ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-600"}`}>
            {STATUS_LABELS[order.status] || order.status}
          </div>
        </div>
      </header>

      <div className="px-4 pt-6">
        <StatusStepper status={order.status} />
      </div>

      <OrderItems items={order.items} />

      <div className="border-t border-gray-200 bg-white px-4 py-4 mt-6">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Total</span>
          <span className="text-xl font-bold text-gray-900">${Number(order.total || 0).toFixed(2)}</span>
        </div>
      </div>

      {order.status !== "delivered" && order.status !== "cancelled" && (
        <div className="px-4 pb-8 pt-4">
          <button onClick={openChat} disabled={openingChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-sm transition-all hover:border-gray-300 hover:shadow-md">
            <MessageSquare className="h-4 w-4" />{openingChat ? "Abriendo chat..." : "Hablar con el mesero"}
          </button>
          <p className="mt-3 text-center text-xs text-gray-400">Esta página se actualiza automáticamente cada 8 segundos</p>
        </div>
      )}

      {(order.status === "delivered" || order.status === "cancelled") && (
        <div className="px-4 pb-8 pt-4">
          <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-center">
            {order.status === "delivered" ? (
              <><Home className="mx-auto mb-2 h-8 w-8 text-green-400" /><p className="text-sm font-medium text-gray-900">Pedido entregado</p><p className="text-xs text-gray-400">¡Gracias por tu visita!</p></>
            ) : (
              <><AlertCircle className="mx-auto mb-2 h-8 w-8 text-red-400" /><p className="text-sm font-medium text-gray-900">Pedido cancelado</p></>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
