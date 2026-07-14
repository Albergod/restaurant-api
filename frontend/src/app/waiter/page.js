"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { apiFetch, logout, getRole, getToken, connectOrdersWebSocket } from "@/lib/api"
import { User, LogOut, AlertCircle, Users, Search, Loader2 } from "lucide-react"
import OrderCard from "@/components/waiter/OrderCard"

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

  useEffect(() => {
    const token = getToken()
    if (!token) { router.replace("/login"); return }
    const userRole = getRole()
    if (!["waiter", "admin"].includes(userRole)) { router.replace("/login"); return }
    setAuthorized(true)
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
        if (e.message?.startsWith("401")) { logout(); router.replace("/login"); return }
        if (!cancelled) setError("Error al cargar pedidos")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadOrders()
    ws = connectOrdersWebSocket(() => loadOrders())
    const interval = setInterval(loadOrders, 5000)
    return () => { cancelled = true; if (ws) ws.close(); clearInterval(interval) }
  }, [authorized, router])

  async function updateStatus(orderId, status) {
    try {
      await apiFetch(`/api/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) })
      const data = await apiFetch("/api/orders/")
      setOrders(Array.isArray(data) ? data : data?.orders || [])
    } catch (e) {
      if (e.message?.startsWith("401")) { logout(); router.replace("/login"); return }
      setError("Error al actualizar el estado")
    }
  }

  function handleLogout() { logout(); router.replace("/login") }

  const pending = orders.filter((o) => o.status === "pending")
  const active = orders.filter((o) => ["confirmed", "preparing", "ready"].includes(o.status))
  const delivered = orders.filter((o) => o.status === "delivered")

  const filteredOrders = activeTab === "pending" ? pending : activeTab === "active" ? active : delivered

  if (!authorized || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#fafafa]"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
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
              <User className="h-3.5 w-3.5" />{role}
            </div>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
            <LogOut className="h-4 w-4" />Salir
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="mb-6 flex gap-2">
        {TABS.map((tab) => {
          const count = tab.key === "pending" ? pending.length : tab.key === "active" ? active.length : delivered.length
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === tab.key ? "bg-amber-500 text-white shadow-sm" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
              {tab.label}
              <span className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-xs font-bold ${activeTab === tab.key ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"}`}>{count}</span>
            </button>
          )
        })}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-20 text-center">
          <Search className="mb-3 h-10 w-10 text-gray-200" />
          <p className="text-sm font-medium text-gray-400">No hay pedidos {activeTab === "pending" ? "pendientes" : activeTab === "active" ? "activos" : "entregados"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredOrders.map((order) => (
            <OrderCard key={order.id} order={order} onUpdateStatus={updateStatus} />
          ))}
        </div>
      )}
    </div>
  )
}
