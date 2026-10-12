"use client"

import { useRouter } from "next/navigation"
import { getRole, logout } from "@/lib/api"
import { PauseCircle, LogOut } from "lucide-react"

/** Pantalla elegante cuando el restaurante no puede operar (registered/suspendido/vencido). */
export default function SuspendedNotice({ state }) {
  const router = useRouter()
  const role = getRole()
  const isAdmin = role === "admin"
  const isRegistered = state === "registered"

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#fafafa] p-4">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-100">
          <PauseCircle className="h-8 w-8 text-red-500" />
        </div>
        <h1 className="text-xl font-black text-gray-900 mb-2">
          {isRegistered ? "Restaurante aún no activo" : "Restaurante en pausa"}
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          {isRegistered ? (
            <>
              Esta cuenta todavía no activó su prueba gratuita. Apenas esté
              lista, verás aquí los pedidos en tiempo real.
            </>
          ) : isAdmin ? (
            <>
              Tu suscripción{" "}
              {state === "expired" ? "venció" : "está suspendida"}. Tus datos,
              menú y QR están intactos: renueva para seguir operando.
            </>
          ) : (
            <>
              Este restaurante pausó su suscripción. Tus datos están a salvo;
              avísale al administrador para reactivarlo.
            </>
          )}
        </p>
        {isAdmin ? (
          <button
            onClick={() => router.push("/admin/billing")}
            className="w-full rounded-xl bg-red-600 py-3 font-bold text-white hover:bg-red-700"
          >
            Renovar suscripción
          </button>
        ) : (
          <button
            onClick={() => {
              logout()
              router.replace("/login")
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" /> Cerrar sesión
          </button>
        )}
      </div>
    </div>
  )
}
