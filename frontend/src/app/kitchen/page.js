"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { apiFetch, logout, getRole, getToken, connectOrdersWebSocket } from "@/lib/api"
import {
  ChefHat,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowRight,
  CookingPot,
  Timer,
  User,
  Loader2,
} from "lucide-react"

const STATUS_LABELS = {
  pending: "Pendiente",
  confirmed: "Confirmado",
  preparing: "En preparación",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
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

export default function KitchenPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [role] = useState(typeof window !== "undefined" ? getRole() : "")
  const pollingRef = useRef(null)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      router.replace("/login")
      return
    }
    const userRole = getRole()
    const allowed = ["kitchen", "admin"]
    if (!allowed.includes(userRole)) {
      router.replace("/login")
      return
    }
    setAuthorized(true) // eslint-disable-line react-hooks/set-state-in-effect
  }, [router])

  useEffect(() => {
    if (!authorized) return
    let cancelled = false
    let ws = null

    async function loadOrders() {
      try {
        const data = await apiFetch("/api/orders/kitchen")
        if (!cancelled) {
          setOrders(data)
          setError(null)
        }
      } catch (e) {
        if (e.message?.startsWith("401")) {
          logout()
          router.replace("/login")
          return
        }
        if (!cancelled) setError("Error al cargar pedidos")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    
    loadOrders()
    ws = connectOrdersWebSocket(() => loadOrders())

    return () => { cancelled = true; if (ws) ws.close() }
  }, [authorized, router])

  async function updateStatus(orderId, status) {
    try {
      await apiFetch(`/api/orders/${orderId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      })
      const data = await apiFetch("/api/orders/kitchen")
      setOrders(data)
    } catch (e) {
      if (e.message?.startsWith("401")) {
        logout()
        router.replace("/login")
        return
      }
      setError("Error al actualizar el estado")
    }
  }

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  const confirmed = orders.filter((o) => o.status === "confirmed")
  const preparing = orders.filter((o) => o.status === "preparing")

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded-lg bg-gray-100" />
          <div className="grid gap-6 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="h-64 rounded-xl bg-gray-100" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
          <p className="mb-4 text-sm font-medium text-red-600">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 shadow-lg shadow-amber-200">
            <ChefHat className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cocina</h1>
            <p className="text-sm text-gray-500">
              Pedidos confirmados y en preparación
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {role && (
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
              <User className="h-3.5 w-3.5" />
              {role}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Confirmados
            </h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
              {confirmed.length}
            </span>
          </div>
          {confirmed.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
              <CheckCircle2 className="mb-2 h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-400">
                No hay pedidos confirmados
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {confirmed.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
                >
                  <div className="border-l-4 border-l-amber-500 p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <p className="text-base font-bold text-gray-900">
                          Pedido #{order.id}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                          <span>
                            Mesa{" "}
                            {order.table_qr ? `#${order.table_qr}` : "—"}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            {getTimeAgo(order.created_at)}
                          </span>
                        </div>
                      </div>
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <div className="mb-3 space-y-1">
                      {(order.items || []).map((item, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-medium text-gray-900">
                            {item.quantity}x
                          </span>{" "}
                          <span className="text-gray-600">
                            {item.product_name || item.name}
                          </span>
                          {item.notes && (
                            <p className="ml-4 text-xs italic text-gray-400">
                              Nota: {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => updateStatus(order.id, "preparing")}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
                    >
                      <ArrowRight className="h-4 w-4" />
                      Iniciar preparación
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
              <CookingPot className="h-4 w-4 text-orange-600" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              En preparación
            </h2>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              {preparing.length}
            </span>
          </div>
          {preparing.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
              <CookingPot className="mb-2 h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-400">
                No hay pedidos en preparación
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {preparing.map((order) => (
                <div
                  key={order.id}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md"
                >
                  <div className="border-l-4 border-l-orange-500 p-4">
                    <div className="mb-3 flex items-start justify-between">
                      <div>
                        <p className="text-base font-bold text-gray-900">
                          Pedido #{order.id}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                          <span>
                            Mesa{" "}
                            {order.table_qr ? `#${order.table_qr}` : "—"}
                          </span>
                          <span>·</span>
                          <span className="flex items-center gap-1">
                            <Timer className="h-3 w-3" />
                            {getTimeAgo(order.created_at)}
                          </span>
                        </div>
                      </div>
                      <span className="rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-700">
                        {STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <div className="mb-3 space-y-1">
                      {(order.items || []).map((item, i) => (
                        <div key={i} className="text-sm">
                          <span className="font-medium text-gray-900">
                            {item.quantity}x
                          </span>{" "}
                          <span className="text-gray-600">
                            {item.product_name || item.name}
                          </span>
                          {item.notes && (
                            <p className="ml-4 text-xs italic text-gray-400">
                              Nota: {item.notes}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      onClick={() => updateStatus(order.id, "ready")}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Marcar como listo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
