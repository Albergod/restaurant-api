"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiFetch, getToken, getRole, logout } from "@/lib/api"
import {
  Store,
  Plus,
  Loader2,
  AlertCircle,
  LogOut,
  Shield,
  CheckCircle2,
  XCircle,
  PowerOff,
  RotateCcw,
  Pencil,
} from "lucide-react"

export default function SuperAdminRestaurantsPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [confirming, setConfirming] = useState(null)
  const [slugInput, setSlugInput] = useState("")
  const [actionError, setActionError] = useState(null)
  const [acting, setActing] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editForm, setEditForm] = useState({ name: "", slug: "" })
  const [editError, setEditError] = useState(null)

  useEffect(() => {
    const token = getToken()
    if (!token) { router.replace("/login"); return }
    if (getRole() !== "superadmin") { router.replace("/login"); return }
    setAuthorized(true)
  }, [router])

  useEffect(() => {
    if (!authorized) return
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const data = await apiFetch("/api/restaurants/")
        if (!cancelled) setRestaurants(data || [])
      } catch (err) {
        if (!cancelled) setError(err.message || "Error al cargar restaurantes")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [authorized])

  function openConfirm(r) {
    setConfirming(r)
    setSlugInput("")
    setActionError(null)
  }

  function closeConfirm() {
    if (acting) return
    setConfirming(null)
    setSlugInput("")
    setActionError(null)
  }

  async function performDeactivate() {
    if (!confirming) return
    if (slugInput.trim() !== confirming.slug) {
      setActionError(`Escribe exactamente el slug "${confirming.slug}" para confirmar`)
      return
    }
    setActing(true)
    setActionError(null)
    try {
      await apiFetch(`/api/restaurants/${confirming.id}`, { method: "DELETE" })
      setConfirming(null)
      setSlugInput("")
      const data = await apiFetch("/api/restaurants/")
      setRestaurants(data || [])
    } catch (err) {
      const msg = String(err.message || "")
      const detail = msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg
      setActionError(detail || "No se pudo desactivar el restaurante")
    } finally {
      setActing(false)
    }
  }

  async function reactivate(r) {
    setActing(true)
    try {
      await apiFetch(`/api/restaurants/${r.id}/reactivate`, { method: "POST" })
      const data = await apiFetch("/api/restaurants/")
      setRestaurants(data || [])
    } catch (err) {
      const msg = String(err.message || "")
      const detail = msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg
      alert(detail || "No se pudo reactivar")
    } finally {
      setActing(false)
    }
  }

  function openEdit(r) {
    setEditing(r)
    setEditForm({ name: r.name, slug: r.slug })
    setEditError(null)
  }

  function closeEdit() {
    if (acting) return
    setEditing(null)
    setEditError(null)
  }

  async function saveEdit() {
    if (!editing) return
    setActing(true)
    setEditError(null)
    try {
      await apiFetch(`/api/restaurants/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify(editForm),
      })
      setEditing(null)
      const data = await apiFetch("/api/restaurants/")
      setRestaurants(data || [])
    } catch (err) {
      const msg = String(err.message || "")
      const detail = msg.includes(":") ? msg.split(":").slice(1).join(":").trim() : msg
      setEditError(detail || "No se pudo guardar")
    } finally {
      setActing(false)
    }
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-amber-500" />
      </div>
    )
  }

  const active = restaurants.filter((r) => r.is_active)
  const inactive = restaurants.filter((r) => !r.is_active)

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 shadow-lg shadow-purple-200">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-gray-900">Superadmin</p>
              <p className="text-xs text-gray-500">Gestión de restaurantes</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.replace("/login") }}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-500 transition-colors hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Restaurantes</h1>
            <p className="mt-1 text-sm text-gray-500">
              {active.length} activo{active.length === 1 ? "" : "s"}
              {inactive.length > 0 ? ` · ${inactive.length} inactivo${inactive.length === 1 ? "" : "s"}` : ""}
            </p>
          </div>
          <button
            onClick={() => router.push("/superadmin/restaurants/new")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:shadow-md hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" />
            Nuevo restaurante
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <span className="font-medium">{error}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
          </div>
        ) : restaurants.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white px-6 py-16 text-center">
            <Store className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-base font-semibold text-gray-900">Sin restaurantes</h3>
            <p className="mt-1 text-sm text-gray-500">Crea el primero para empezar.</p>
            <button
              onClick={() => router.push("/superadmin/restaurants/new")}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
            >
              <Plus className="h-4 w-4" />
              Crear restaurante
            </button>
          </div>
        ) : (
          <div className="space-y-8">
                {active.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Activos</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {active.map((r) => (
                    <RestaurantCard
                      key={r.id}
                      r={r}
                      acting={acting}
                      onDeactivate={openConfirm}
                      onReactivate={reactivate}
                      onEdit={openEdit}
                    />
                  ))}
                </div>
              </section>
            )}

            {inactive.length > 0 && (
              <section>
                <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Inactivos</h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {inactive.map((r) => (
                    <RestaurantCard
                      key={r.id}
                      r={r}
                      acting={acting}
                      onDeactivate={openConfirm}
                      onReactivate={reactivate}
                      onEdit={openEdit}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </main>

      {confirming && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-100">
                <PowerOff className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Desactivar restaurante</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Vas a desactivar <strong>{confirming.name}</strong>. Sus usuarios no podrán iniciar sesión
                  y no aparecerá en listados, pero sus datos (pedidos, mesas, productos) se conservan.
                </p>
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                Escribe <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs">{confirming.slug}</code> para confirmar
              </label>
              <input
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                placeholder={confirming.slug}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-mono outline-none transition-all focus:border-red-400 focus:ring-4 focus:ring-red-100"
                autoFocus
                disabled={acting}
              />
            </div>

            {actionError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{actionError}</span>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={closeConfirm}
                disabled={acting}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={performDeactivate}
                disabled={acting || slugInput.trim() !== confirming.slug}
                className="flex-1 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {acting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Desactivar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Pencil className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900">Editar restaurante</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Cambia el nombre y/o el slug. El slug es el identificador URL único.
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Nombre</label>
                <input
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  disabled={acting}
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-gray-700">Slug</label>
                <input
                  value={editForm.slug}
                  onChange={(e) => setEditForm({ ...editForm, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-") })}
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-mono outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                  disabled={acting}
                />
                <p className="mt-1 text-xs text-gray-500">Solo minúsculas, números y guiones.</p>
              </div>
            </div>

            {editError && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{editError}</span>
              </div>
            )}

            <div className="mt-6 flex gap-3">
              <button
                onClick={closeEdit}
                disabled={acting}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={acting || !editForm.name.trim() || !editForm.slug.trim()}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {acting ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function RestaurantCard({ r, acting, onDeactivate, onReactivate, onEdit }) {
  return (
    <article
      className={`group rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
        r.is_active ? "border-gray-200 hover:border-amber-300" : "border-gray-200 opacity-75"
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${r.is_active ? "bg-amber-50" : "bg-gray-100"}`}>
          <Store className={`h-5 w-5 ${r.is_active ? "text-amber-600" : "text-gray-400"}`} />
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => onEdit(r)}
            disabled={acting}
            title="Editar"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700 disabled:opacity-50"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          {r.is_active ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Activo
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
              <XCircle className="h-3.5 w-3.5" />
              Inactivo
            </span>
          )}
        </div>
      </div>

      <h3 className="mt-4 text-base font-bold text-gray-900">{r.name}</h3>
      <p className="mt-1 text-xs text-gray-500">
        Slug: <code className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[11px]">{r.slug}</code>
      </p>
      <p className="mt-1 text-xs text-gray-400">ID: {r.id}</p>

      <div className="mt-4 flex gap-2 border-t border-gray-100 pt-3">
        {r.is_active ? (
          <button
            onClick={() => onDeactivate(r)}
            disabled={acting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
          >
            <PowerOff className="h-3.5 w-3.5" />
            Desactivar
          </button>
        ) : (
          <button
            onClick={() => onReactivate(r)}
            disabled={acting}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reactivar
          </button>
        )}
      </div>
    </article>
  )
}
