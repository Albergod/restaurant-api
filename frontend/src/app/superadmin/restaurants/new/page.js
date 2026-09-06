"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { apiFetch, getToken, getRole, logout } from "@/lib/api"
import {
  Shield,
  ArrowLeft,
  Store,
  Mail,
  KeyRound,
  User as UserIcon,
  AlertCircle,
  CheckCircle2,
  Loader2,
  LogOut,
  Copy,
} from "lucide-react"

function slugify(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

export default function NewRestaurantPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [form, setForm] = useState({
    name: "",
    slug: "",
    admin_name: "",
    admin_email: "",
    admin_password: "",
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [created, setCreated] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const token = getToken()
    if (!token) { router.replace("/login"); return }
    if (getRole() !== "superadmin") { router.replace("/login"); return }
    setAuthorized(true)
  }, [router])

  function update(field, value) {
    setForm((prev) => {
      const next = { ...prev, [field]: value }
      if (field === "name" && !slugTouched) {
        next.slug = slugify(value)
      }
      if (field === "slug") {
        setSlugTouched(true)
        next.slug = slugify(value)
      }
      return next
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError(null)
    if (!form.name || !form.slug) {
      setError("Nombre y slug son obligatorios")
      return
    }
    setSubmitting(true)
    try {
      const data = await apiFetch("/api/restaurants/", {
        method: "POST",
        body: JSON.stringify(form),
      })
      setCreated(data)
    } catch (err) {
      setError(err.message || "Error al crear restaurante")
    } finally {
      setSubmitting(false)
    }
  }

  function copy(text) {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
    }
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-amber-500" />
      </div>
    )
  }

  if (created) {
    return (
      <div className="min-h-screen bg-[#fafafa]">
        <header className="border-b border-gray-200 bg-white">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-bold text-gray-900">Superadmin</p>
                <p className="text-xs text-gray-500">Gestión de restaurantes</p>
              </div>
            </div>
            <button
              onClick={() => { logout(); router.replace("/login") }}
              className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" />
              Salir
            </button>
          </div>
        </header>

        <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
          <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
              <h2 className="text-lg font-bold text-green-900">Restaurante creado</h2>
            </div>
            <p className="mt-2 text-sm text-green-800">
              Guarda estas credenciales. Las contraseñas <strong>no se mostrarán de nuevo</strong>.
            </p>

            <div className="mt-5 space-y-4">
              <div>
                <p className="text-sm font-bold text-gray-700">Restaurante</p>
                <p className="mt-1 text-sm text-gray-900">{created.name}</p>
                <p className="mt-0.5 text-xs text-gray-500">
                  Slug: <code className="rounded bg-white px-1.5 py-0.5 font-mono">{created.slug}</code>
                </p>
              </div>

              <CredentialBlock
                title="Administrador"
                email={created.admin_email}
                password={created.admin_password}
                onCopy={copy}
                copied={copied}
              />
              {created.waiter_email && (
                <CredentialBlock
                  title="Mesero"
                  email={created.waiter_email}
                  password={created.waiter_password}
                  onCopy={copy}
                  copied={copied}
                />
              )}
              {created.kitchen_email && (
                <CredentialBlock
                  title="Cocina"
                  email={created.kitchen_email}
                  password={created.kitchen_password}
                  onCopy={copy}
                  copied={copied}
                />
              )}
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <button
                onClick={() => router.push("/superadmin/restaurants")}
                className="flex-1 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600"
              >
                Volver al listado
              </button>
              <button
                onClick={() => {
                  setCreated(null)
                  setForm({ name: "", slug: "", admin_name: "", admin_email: "", admin_password: "" })
                  setSlugTouched(false)
                }}
                className="flex-1 rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
              >
                Crear otro
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }
}

function CredentialBlock({ title, email, password, onCopy, copied }) {
  return (
    <div className="rounded-lg border border-green-200 bg-white p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">{title}</p>
      <div className="mt-2 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-gray-50 px-2 py-1 font-mono text-xs">{email}</code>
        <button onClick={() => onCopy(email)} className="text-gray-400 hover:text-amber-600">
          <Copy className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        <code className="flex-1 truncate rounded bg-gray-50 px-2 py-1 font-mono text-xs">{password}</code>
        <button onClick={() => onCopy(password)} className="text-gray-400 hover:text-amber-600">
          <Copy className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

  return (
    <div className="min-h-screen bg-[#fafafa]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/superadmin/restaurants")}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="text-sm font-bold text-gray-900">Nuevo restaurante</p>
              <p className="text-xs text-gray-500">Crea el restaurante y su administrador inicial</p>
            </div>
          </div>
          <button
            onClick={() => { logout(); router.replace("/login") }}
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-50"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {error && (
            <div className="mb-6 flex items-center gap-3 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span className="font-medium">{error}</span>
            </div>
          )}

          <section className="space-y-5">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              <Store className="h-4 w-4" />
              Datos del restaurante
            </h2>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Nombre</label>
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="Pizzería Don Pepe"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                required
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Slug</label>
              <input
                value={form.slug}
                onChange={(e) => update("slug", e.target.value)}
                placeholder="pizzeria-don-pepe"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-mono outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
                required
              />
              <p className="mt-1 text-xs text-gray-500">Identificador URL único. Solo minúsculas, números y guiones.</p>
            </div>
          </section>

          <hr className="my-6 border-gray-200" />

          <section className="space-y-5">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500">
              <UserIcon className="h-4 w-4" />
              Administrador inicial
            </h2>
            <p className="-mt-3 text-xs text-gray-500">
              Si dejas el email o la contraseña vacíos, el sistema los generará automáticamente.
            </p>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">Nombre</label>
              <input
                value={form.admin_name}
                onChange={(e) => update("admin_name", e.target.value)}
                placeholder="Juan Pérez"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                <Mail className="inline h-4 w-4 mr-1 -mt-0.5" />
                Email
              </label>
              <input
                type="email"
                value={form.admin_email}
                onChange={(e) => update("admin_email", e.target.value)}
                placeholder="juan@pizzeria.com"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-gray-700">
                <KeyRound className="inline h-4 w-4 mr-1 -mt-0.5" />
                Contraseña
              </label>
              <input
                type="text"
                value={form.admin_password}
                onChange={(e) => update("admin_password", e.target.value)}
                placeholder="(se generará automáticamente si se deja vacío)"
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm outline-none transition-all focus:border-amber-400 focus:ring-4 focus:ring-amber-100"
              />
            </div>
          </section>

          <div className="mt-8 flex gap-3">
            <button
              type="button"
              onClick={() => router.push("/superadmin/restaurants")}
              className="rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-bold text-white transition-all hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creando...
                </>
              ) : (
                "Crear restaurante"
              )}
            </button>
          </div>
        </form>
      </main>
    </div>
  )
}
