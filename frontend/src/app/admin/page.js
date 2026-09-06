"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { apiFetch, getToken, getRole, logout } from "@/lib/api"
import {
  Users,
  ShoppingBag,
  ChefHat,
  TrendingUp,
  DollarSign,
  Clock,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react"

export default function AdminDashboard() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [stats, setStats] = useState({
    totalOrders: 0,
    pendingOrders: 0,
    activeOrders: 0,
    totalRevenue: 0,
    todayOrders: 0,
    todayRevenue: 0,
    totalUsers: 0,
    activeTables: 0,
    totalTables: 0,
    pendingCount: 0,
    confirmedCount: 0,
    preparingCount: 0,
    readyCount: 0,
  })

  useEffect(() => {
    const token = getToken()
    if (!token) { router.replace("/login"); return }
    const userRole = getRole()
    if (userRole !== "admin") { router.replace("/login"); return }
    setAuthorized(true)
  }, [router])

  useEffect(() => {
    if (!authorized) return
    let cancelled = false

    async function loadStats() {
      try {
        const [orders, tables, users] = await Promise.all([
          apiFetch("/api/orders/"),
          apiFetch("/api/tables/"),
          apiFetch("/api/users/"),
        ])

        if (cancelled) return

        const ordersList = Array.isArray(orders) ? orders : orders?.orders || []
        const today = new Date()
        today.setHours(0, 0, 0, 0)

        const todayOrdersList = ordersList.filter(
          (o) => new Date(o.created_at) >= today
        )

        setStats({
          totalOrders: ordersList.length,
          pendingOrders: ordersList.filter((o) => o.status === "pending").length,
          activeOrders: ordersList.filter(
            (o) =>
              o.status === "confirmed" ||
              o.status === "preparing" ||
              o.status === "ready"
          ).length,
          totalRevenue: ordersList
            .filter((o) => o.status === "delivered")
            .reduce((s, o) => s + Number(o.total || 0), 0),
          todayOrders: todayOrdersList.length,
          todayRevenue: todayOrdersList
            .filter((o) => o.status === "delivered")
            .reduce((s, o) => s + Number(o.total || 0), 0),
          totalUsers: Array.isArray(users) ? users.length : 0,
          activeTables: Array.isArray(tables)
            ? tables.filter((t) => t.is_occupied).length
            : 0,
          totalTables: Array.isArray(tables) ? tables.length : 0,
          pendingCount: ordersList.filter((o) => o.status === "pending").length,
          confirmedCount: ordersList.filter((o) => o.status === "confirmed").length,
          preparingCount: ordersList.filter((o) => o.status === "preparing").length,
          readyCount: ordersList.filter((o) => o.status === "ready").length,
        })
      } catch (e) {
        if (e.message?.startsWith("401")) {
          logout()
          router.replace("/login")
          return
        }
        if (!cancelled) setError("Error al cargar estadísticas")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    loadStats()
    const interval = setInterval(loadStats, 15000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [authorized, router])

  if (!authorized || loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12">
        <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
        <p className="text-sm font-medium text-red-600">{error}</p>
      </div>
    )
  }

  const cards = [
    {
      label: "Pedidos totales",
      value: stats.totalOrders,
      icon: ShoppingBag,
      color: "bg-blue-50 text-blue-600",
      bg: "bg-blue-500",
      change: `${stats.todayOrders} hoy`,
      changeIcon: ArrowUpRight,
    },
    {
      label: "Ingresos totales",
      value: `$${stats.totalRevenue.toFixed(2)}`,
      icon: DollarSign,
      color: "bg-green-50 text-green-600",
      bg: "bg-green-500",
      change: `$${stats.todayRevenue.toFixed(2)} hoy`,
      changeIcon: TrendingUp,
    },
    {
      label: "Usuarios",
      value: stats.totalUsers,
      icon: Users,
      color: "bg-purple-50 text-purple-600",
      bg: "bg-purple-500",
      change: "staff registrado",
      changeIcon: Users,
    },
    {
      label: "Mesas",
      value: stats.totalTables,
      icon: ChefHat,
      color: "bg-orange-50 text-orange-600",
      bg: "bg-orange-500",
      change: `${stats.activeTables} ocupadas`,
      changeIcon: stats.activeTables > 0 ? ArrowUpRight : ArrowDownRight,
    },
  ]

  const statusCards = [
    { label: "Pendientes", value: stats.pendingCount, color: "text-yellow-600 bg-yellow-50 border-yellow-200" },
    { label: "Confirmados", value: stats.confirmedCount, color: "text-blue-600 bg-blue-50 border-blue-200" },
    { label: "Preparando", value: stats.preparingCount, color: "text-orange-600 bg-orange-50 border-orange-200" },
    { label: "Listos", value: stats.readyCount, color: "text-green-600 bg-green-50 border-green-200" },
  ]

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Resumen general del restaurante</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition-all hover:shadow-md"
          >
            <div className="flex items-start justify-between mb-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.color}`}>
                <card.icon className="h-5 w-5" />
              </div>
              <div className="flex items-center gap-1 text-xs font-medium text-gray-400">
                <card.changeIcon className="h-3 w-3" />
                <span>{card.change}</span>
              </div>
            </div>
            <p className="text-2xl font-black text-gray-900">{card.value}</p>
            <p className="text-xs font-medium text-gray-500 mt-1">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Status Distribution */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        {statusCards.map((s) => (
          <div
            key={s.label}
            className={`rounded-xl border-2 p-4 text-center transition-all ${s.color}`}
          >
            <p className="text-3xl font-black">{s.value}</p>
            <p className="text-xs font-bold uppercase tracking-wider mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-bold text-gray-900">Acciones rápidas</h2>
        </div>
        <div className="grid gap-3 p-5 sm:grid-cols-3">
          <button
            onClick={() => router.push("/admin/users")}
            className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 text-left transition-all hover:bg-amber-50 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Usuarios</p>
              <p className="text-xs text-gray-500">Gestionar staff</p>
            </div>
          </button>
          <button
            onClick={() => router.push("/admin/menu")}
            className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 text-left transition-all hover:bg-amber-50 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <ShoppingBag className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Menú</p>
              <p className="text-xs text-gray-500">Categorías y productos</p>
            </div>
          </button>
          <button
            onClick={() => router.push("/admin/tables")}
            className="flex items-center gap-3 rounded-xl bg-gray-50 p-4 text-left transition-all hover:bg-amber-50 hover:shadow-sm"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-100 text-orange-600">
              <ChefHat className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Mesas</p>
              <p className="text-xs text-gray-500">Administrar mesas</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  )
}
