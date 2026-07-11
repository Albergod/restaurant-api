"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { apiFetch, logout, getRole, getToken, connectOrdersWebSocket } from "@/lib/api"
import {
  User,
  LogOut,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  ChefHat,
  Package,
  Users,
  ClipboardList,
  Search,
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

const STATUS_STYLES = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
}

const STATUS_ICONS = {
  pending: Clock,
  confirmed: Package,
  preparing: ChefHat,
  ready: CheckCircle2,
  delivered: ClipboardList,
  cancelled: XCircle,
}

const TABS = [
  { key: "pending", label: "Pendientes" },
  { key: "active", label: "Activos" },
  { key: "delivered", label: "Entregados" },
]

export default function WaiterPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [role] = useState(typeof window !== "undefined" ? getRole() : "")
  const [activeTab, setActiveTab] = useState("pending")
  const pollingRef = useRef(null)

  useEffect(() => {
    const token = getToken()
    if (!token) {
      router.replace("/login")
      return
    }
    const userRole = getRole()
    const allowed = ["waiter", "admin"]
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
        const data = await apiFetch("/api/orders/")
        if (!cancelled) {
          setOrders(Array.isArray(data) ? data : data?.orders || [])
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
      const data = await apiFetch("/api/orders/")
      setOrders(Array.isArray(data) ? data : data?.orders || [])
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

  const pending = orders.filter((o) => o.status === "pending")
  const active = orders.filter(
    (o) =>
      o.status === "confirmed" ||
      o.status === "preparing" ||
      o.status === "ready"
  )
  const delivered = orders.filter((o) => o.status === "delivered")

  const filteredOrders =
    activeTab === "pending"
      ? pending
      : activeTab === "active"
      ? active
      : delivered

  function OrderCard({ order }) {
    const StatusIcon = STATUS_ICONS[order.status] || Clock
    const borderColor =
      order.status === "pending"
        ? "border-l-yellow-400"
        : order.status === "confirmed"
        ? "border-l-blue-400"
        : order.status === "preparing"
        ? "border-l-orange-400"
        : order.status === "ready"
        ? "border-l-green-400"
        : "border-l-gray-200"

    return (
      <div
        className={`rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md border-l-4 ${borderColor}`}
      >
        <div className="p-4">
          <div className="mb-2 flex items-start justify-between">
            <div>
              <p className="text-base font-bold text-gray-900">
                Pedido #{order.id}
              </p>
              <p className="text-xs text-gray-500">
                Mesa {order.table_qr ? `#${order.table_qr}` : "—"}
              </p>
            </div>
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                STATUS_STYLES[order.status] || "bg-gray-100 text-gray-600"
              }`}
            >
              <StatusIcon className="h-3 w-3" />
              {STATUS_LABELS[order.status] || order.status}
            </span>
          </div>

          <div className="mb-3 space-y-1">
            {(order.items || []).map((item, i) => (
              <p key={i} className="text-sm text-gray-600">
                <span className="font-medium text-gray-900">
                  {item.quantity}x
                </span>{" "}
                {item.product_name || item.name}
              </p>
            ))}
          </div>

          <div className="flex gap-2">
            {order.status === "pending" && (
              <button
                onClick={() => updateStatus(order.id, "confirmed")}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
              >
                <CheckCircle2 className="h-4 w-4" />
                Confirmar
              </button>
            )}
            {order.status === "pending" && (
              <button
                onClick={() => updateStatus(order.id, "cancelled")}
                className="flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-red-50 hover:text-red-600"
              >
                <XCircle className="h-4 w-4" />
                Cancelar
              </button>
            )}
            {order.status === "ready" && (
              <button
                onClick={() => updateStatus(order.id, "delivered")}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-green-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-green-600"
              >
                <CheckCircle2 className="h-4 w-4" />
                Entregar
              </button>
            )}
          </div>
        </div>
      </div>
    )
  }

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
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 rounded-lg bg-gray-100" />
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-9 flex-1 rounded-lg bg-gray-100" />
            ))}
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-gray-100" />
          ))}
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
            <Users className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mesero</h1>
            <p className="text-sm text-gray-500">Gestión de pedidos</p>
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

      <div className="mb-6 flex gap-2">
        {TABS.map((tab) => {
          const count =
            tab.key === "pending"
              ? pending.length
              : tab.key === "active"
              ? active.length
              : delivered.length
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? "bg-amber-500 text-white shadow-sm"
                  : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {tab.label}
              <span
                className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${
                  activeTab === tab.key
                    ? "bg-white/20 text-white"
                    : "bg-gray-100 text-gray-500"
                }`}
              >
                {count}
              </span>
            </button>
          )
        })}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <Search className="mb-3 h-10 w-10 text-gray-200" />
          <p className="text-sm font-medium text-gray-400">
            No hay pedidos{" "}
            {activeTab === "pending"
              ? "pendientes"
              : activeTab === "active"
              ? "activos"
              : "entregados"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  )
}
