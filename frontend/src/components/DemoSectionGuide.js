"use client"

import { useRouter } from "next/navigation"
import { Sparkles, ArrowRight } from "lucide-react"
import { isDemoTour } from "@/components/DemoTourTabs"

/** Guía contextual del tour demo: explica qué hacer en cada apartado.
 *
 * Solo existe en modo demo (cuentas reales nunca la ven: el dueño real ya
 * tiene el OnboardingChecklist del dashboard). Como la demo viene
 * pre-poblada, en vez de estados vacíos muestra la "misión" de cada vista.
 */
const GUIDES = {
  panel: {
    step: "Paso 1 de 4",
    title: "Tu centro de mando",
    body: "Aquí ves ventas, pedidos y tu equipo. Todo es ficticio: crea, borra y juega sin miedo. Cuando quieras, abre la pestaña Cliente.",
  },
  "menu-admin": {
    step: "Tu carta",
    title: "Categorías, platos, fotos y precios",
    body: "Crea una categoría nueva y mueve un plato de una a otra. Los precios se escriben en pesos: 25000 se ve $ 25.000.",
    cta: { label: "Ver mesas y QR", href: "/admin/tables" },
  },
  tables: {
    step: "Tus mesas",
    title: "Cada mesa tiene su QR",
    body: "Imprímelo y el cliente pide desde el celular. Crea una mesa y abre su código para verte como comensal.",
    cta: { label: "Ver equipo", href: "/admin/users" },
  },
  users: {
    step: "Tu equipo",
    title: "Meseros y cocina",
    body: "Crea un mesero: luego podrás entrar a su vista desde la pestaña Mesero del tour.",
    cta: { label: "Ver facturación", href: "/admin/billing" },
  },
  billing: {
    step: "Tu suscripción",
    title: "Prueba, planes y pagos",
    body: "En demo los pagos están apagados. Prueba el selector de moneda de tu carta (COP/USD) y mira cómo cambian los precios.",
    cta: { label: "Volver al panel", href: "/admin" },
  },
  cliente: {
    step: "Paso 2 de 4",
    title: "Así te ve un comensal",
    body: "Agrega algo al carrito y pide de verdad: tu pedido aparecerá en la pestaña Mesero.",
  },
  mesero: {
    step: "Paso 3 de 4",
    title: "Aquí caen los pedidos",
    body: "Confirma el pedido que acabas de hacer como cliente y pasará a la pestaña Cocina.",
    cta: { label: "Ir a Cocina", href: "/kitchen" },
  },
  cocina: {
    step: "Paso 4 de 4",
    title: "Prepara y marca listo",
    body: "Avanza el pedido hasta entregado. Vuelve al Panel y míralo en el historial. ¿Otra ronda? Pulsa Reiniciar en la barra.",
    cta: { label: "Volver al Panel", href: "/admin" },
  },
}

export default function DemoSectionGuide({ section }) {
  const router = useRouter()
  if (!isDemoTour()) return null
  const guide = GUIDES[section]
  if (!guide) return null

  return (
    <div className="mx-4 mt-3 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
      <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 rounded-full bg-gray-900 px-2 py-0.5 text-[10px] font-black tracking-wide text-amber-300">
        <Sparkles className="h-3 w-3" /> DEMO
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-black uppercase tracking-wide text-amber-700">
          {guide.step} · {guide.title}
        </p>
        <p className="mt-0.5 text-sm text-gray-700">{guide.body}</p>
      </div>
      {guide.cta && (
        <button
          onClick={() => router.push(guide.cta.href)}
          className="inline-flex shrink-0 items-center gap-1 rounded-xl bg-gray-900 px-3 py-2 text-xs font-bold text-white hover:bg-gray-700"
        >
          {guide.cta.label} <ArrowRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )
}
