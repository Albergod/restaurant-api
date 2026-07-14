"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { apiFetch, logout, getRole, getToken, connectOrdersWebSocket } from "@/lib/api"
import { ChefHat, LogOut, AlertCircle, CheckCircle2, Clock, CookingPot, User, Loader2 } from "lucide-react"
import KitchenOrderCard from "@/components/kitchen/OrderCard"

export default function KitchenPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [role] = useState(typeof window !== "undefined" ? getRole() : "")

  useEffect(() => {
    const token = getToken()
    if (!token) { router.replace("/login"); return }
    if (!["kitchen", "admin"].includes(getRole())) { router.replace("/login"); return }
    setAuthorized(true)
  }, [router])

  useEffect(() => {
    if (!authorized) return
    let cancelled = false
    let ws = null

    async function loadOrders() {
      try {
        const data = await apiFetch("/api/orders/kitchen")
        if (!cancelled) { setOrders(data); setError(null) }
      } catch (e) {
        if (e.message?.startsWith("401")) { logout(); router.replace("/login"); return }
        if (!cancelled) setError("Error al cargar pedidos")
      } finally { if (!cancelled) setLoading(false) }
    }

    loadOrders()
    ws = connectOrdersWebSocket(() => loadOrders())
    return () => { cancelled = true; if (ws) ws.close() }
  }, [authorized, router])

  async function updateStatus(orderId, status) {
    try {
      await apiFetch(`/api/orders/${orderId}/status`, { method: "PATCH", body: JSON.stringify({ status }) })
      const data = await apiFetch("/api/orders/kitchen")
      setOrders(data)
    } catch (e) {
      if (e.message?.startsWith("401")) { logout(); router.replace("/login"); return }
      setError("Error al actualizar el estado")
    }
  }

  function handleLogout() { logout(); router.replace("/login") }

  const confirmed = orders.filter((o) => o.status === "confirmed")
  const preparing = orders.filter((o) => o.status === "preparing")

  if (!authorized || loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[#fafafa]"><Loader2 className="h-6 w-6 animate-spin text-gray-300" /></div>
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
            <p className="text-sm text-gray-500">Pedidos confirmados y en preparación</p>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100">
              <Clock className="h-4 w-4 text-blue-600" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Confirmados</h2>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">{confirmed.length}</span>
          </div>
          {confirmed.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
              <CheckCircle2 className="mb-2 h-8 w-8 text-gray-200" /><p className="text-sm text-gray-400">No hay pedidos confirmados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {confirmed.map((order) => <KitchenOrderCard key={order.id} order={order} onUpdateStatus={updateStatus} />)}
            </div>
          )}
        </div>

        <div>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-100">
              <CookingPot className="h-4 w-4 text-orange-600" />
            </div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">En preparación</h2>
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">{preparing.length}</span>
          </div>
          {preparing.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-12 text-center">
              <CookingPot className="mb-2 h-8 w-8 text-gray-200" /><p className="text-sm text-gray-400">No hay pedidos en preparación</p>
            </div>
          ) : (
            <div className="space-y-3">
              {preparing.map((order) => <KitchenOrderCard key={order.id} order={order} onUpdateStatus={updateStatus} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
