"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { apiFetch } from "@/lib/api"
import {
  Users,
  AlertCircle,
  Plus,
  Pencil,
  Trash2,
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Mail,
  Shield,
  PersonStanding,
} from "lucide-react"

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "waiter", label: "Mesero" },
  { value: "kitchen", label: "Cocina" },
  { value: "customer", label: "Cliente" },
]

function RoleBadge({ role }) {
  const styles = {
    admin: "bg-purple-100 text-purple-700",
    waiter: "bg-blue-100 text-blue-700",
    kitchen: "bg-orange-100 text-orange-700",
    customer: "bg-gray-100 text-gray-600",
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium ${styles[role] || styles.customer}`}>
      <Shield className="h-3 w-3" />
      {ROLE_OPTIONS.find((r) => r.value === role)?.label || role}
    </span>
  )
}

export default function AdminUsersPage() {
  const router = useRouter()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState("")

  const [dialogOpen, setDialogOpen] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(null)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    role: "waiter",
  })

  const loadUsers = useCallback(async () => {
    try {
      const data = await apiFetch("/api/users/")
      setUsers(Array.isArray(data) ? data : [])
      setError(null)
    } catch (e) {
      if (e.message?.startsWith("401")) {
        router.replace("/login")
        return
      }
      setError("Error cargando usuarios")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { loadUsers() }, [loadUsers])

  function openNewDialog() {
    setEditId(null)
    setForm({ name: "", email: "", password: "", role: "waiter" })
    setDialogOpen(true)
  }

  function openEditDialog(user) {
    setEditId(user.id)
    setForm({ name: user.name, email: user.email, password: "", role: user.role })
    setDialogOpen(true)
  }

  async function saveUser() {
    try {
      if (editId) {
        const body = { name: form.name, email: form.email };
        if (form.password) body.password = form.password;
        if (form.role) body.role = form.role;
        await apiFetch(`/api/users/${editId}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
      } else {
        await apiFetch("/api/users/", {
          method: "POST",
          body: JSON.stringify(form),
        })
      }
      setDialogOpen(false)
      loadUsers()
    } catch (e) {
      setError(e.message?.startsWith("40") ? "Error al guardar usuario" : "Error al guardar usuario")
    }
  }

  async function handleDelete(userId) {
    try {
      await apiFetch(`/api/users/${userId}`, { method: "DELETE" })
      setDeleteDialog(null)
      loadUsers()
    } catch (e) {
      setError("Error al eliminar usuario")
    }
  }

  const filtered = search
    ? users.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      )
    : users

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuarios</h1>
          <p className="text-sm text-gray-500 mt-1">
            {users.length} usuario{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={openNewDialog}
          className="flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 shadow-sm"
        >
          <Plus className="h-5 w-5" />
          Nuevo usuario
        </button>
      </div>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700 border border-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="p-4 border-b border-gray-100">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar usuario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-xl border border-gray-200 py-2 pl-9 pr-4 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-4">
            <Users className="mb-2 h-12 w-12 text-gray-200" />
            <p className="text-sm text-gray-400">
              {search ? "No se encontraron usuarios" : "No hay usuarios registrados"}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map((user) => (
              <div key={user.id} className="flex items-center gap-4 p-4 transition-colors hover:bg-gray-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-gray-100 to-gray-200">
                  <PersonStanding className="h-5 w-5 text-gray-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-900 truncate">{user.name}</p>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-400">
                    <Mail className="h-3 w-3 shrink-0" />
                    <span className="truncate">{user.email}</span>
                  </div>
                </div>
                <div className="hidden sm:flex items-center gap-2">
                  <RoleBadge role={user.role} />
                  {user.is_active ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                      <CheckCircle2 className="h-3 w-3" />
                      Activo
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                      <XCircle className="h-3 w-3" />
                      Inactivo
                    </span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEditDialog(user)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleteDialog(user)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      {dialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDialogOpen(false)} />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl animate-slide-up">
            <h3 className="text-lg font-bold text-gray-900">
              {editId ? "Editar usuario" : "Crear usuario"}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nombre completo"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="usuario@email.com"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  {editId ? "Nueva contraseña (dejar vacío para mantener)" : "Contraseña"}
                </label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder={editId ? "Sin cambios" : "Contraseña"}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">Rol</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                >
                  {ROLE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setDialogOpen(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveUser}
                disabled={!form.name || !form.email || (!editId && !form.password)}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:opacity-50"
              >
                {editId ? "Guardar" : "Crear usuario"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {deleteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setDeleteDialog(null)} />
          <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl animate-slide-up">
            <h3 className="text-lg font-bold text-gray-900">Eliminar usuario</h3>
            <p className="mt-2 text-sm text-gray-600">
              ¿Estás seguro de eliminar a <span className="font-bold">{deleteDialog.name}</span>? Esta acción no se puede deshacer.
            </p>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setDeleteDialog(null)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={() => handleDelete(deleteDialog.id)}
                className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
