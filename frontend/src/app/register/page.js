"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { API_URL } from "@/lib/api"
import { ChefHat, ArrowRight, AlertCircle, Loader2, Check } from "lucide-react"

function slugify(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)
  const [adminName, setAdminName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const websiteRef = useRef(null)

  function handleName(value) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    if (!name.trim() || !slug.trim() || !adminName.trim() || !email.trim() || password.length < 8) {
      setError("Completa todos los campos (contraseña mínima 8 caracteres)")
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/api/restaurants/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          admin_name: adminName.trim(),
          admin_email: email.trim(),
          admin_password: password,
          website: websiteRef.current ? websiteRef.current.value : "",
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.detail || "No se pudo crear la cuenta")
      localStorage.setItem("token", data.access_token)
      localStorage.setItem("role", data.role)
      router.replace("/admin")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrarse")
    } finally {
      setLoading(false)
    }
  }

  const inputCls =
    "w-full rounded-xl border border-gray-700 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-gray-500 outline-none focus:border-amber-500"

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500">
            <ChefHat className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-black text-white">Crea tu restaurante</h1>
          <p className="text-sm text-gray-400 mt-1">Gratis · Sin tarjeta · En 1 minuto</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl bg-white/5 border border-white/10 p-6 space-y-3">
          <input value={name} onChange={(e) => handleName(e.target.value)} placeholder="Nombre del restaurante" className={inputCls} />
          <div>
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">tuapp.com/</span>
              <input
                value={slug}
                onChange={(e) => { setSlugTouched(true); setSlug(slugify(e.target.value)) }}
                placeholder="mi-restaurante"
                className={inputCls}
              />
            </div>
            <p className="text-[11px] text-gray-500 mt-1">Minúsculas, números y guiones. No cambiará nunca.</p>
          </div>
          <input value={adminName} onChange={(e) => setAdminName(e.target.value)} placeholder="Tu nombre" className={inputCls} />
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="Correo electrónico" className={inputCls} />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Contraseña (mínimo 8 caracteres)"
            className={inputCls}
          />
          {/* Honeypot anti-bots: los humanos no lo ven ni lo llenan */}
          <input ref={websiteRef} type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

          {error && (
            <p className="flex items-start gap-2 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /> {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3.5 font-bold text-white hover:scale-[1.01] transition-transform disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <>Crear mi restaurante <ArrowRight className="h-5 w-5" /></>}
          </button>

          <ul className="text-xs text-gray-400 space-y-1 pt-1">
            {["Sin tarjeta de crédito", "Activas tu prueba de 14 días cuando quieras", "Tu menú y tu QR no cambian nunca"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="h-3.5 w-3.5 text-green-400" /> {t}
              </li>
            ))}
          </ul>
        </form>

        <p className="text-center text-sm text-gray-500 mt-4">
          ¿Ya tienes cuenta?{" "}
          <Link href="/login" className="text-amber-400 font-semibold hover:text-amber-300">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
