"use client"

import { useRouter } from "next/navigation"
import { waLink } from "@/lib/site"
import {
  ChefHat, ArrowRight, QrCode, MessageSquare, ChefHat as KitchenIcon,
  BarChart3, Check, Smartphone, ChevronDown, Play,
} from "lucide-react"
import { useState } from "react"

const STEPS = [
  { n: "1", title: "Crea tu cuenta gratis", desc: "Registra tu restaurante en 1 minuto, sin tarjeta." },
  { n: "2", title: "Sube tu menú", desc: "Carga tus platos con fotos y precios. Te guiamos paso a paso." },
  { n: "3", title: "Imprime tu QR y vende", desc: "Tus clientes escanean, piden y pagan. Tú solo atiendes." },
]

const FEATURES = [
  { icon: QrCode, title: "Menú QR por mesa", desc: "Cada mesa con su QR. El cliente pide desde el celular, sin app." },
  { icon: MessageSquare, title: "Pedidos en tiempo real", desc: "Del QR a la cocina en segundos, sin gritos ni papelitos." },
  { icon: KitchenIcon, title: "Pantalla de cocina", desc: "Comandas ordenadas por estado: confirmado, preparando, listo." },
  { icon: Smartphone, title: "Panel del mesero", desc: "Confirmar, entregar y chatear con cada mesa desde el celular." },
  { icon: BarChart3, title: "Reportes de venta", desc: "Ingresos del día, platos más vendidos y horas pico." },
  { icon: ChefHat, title: "Multi-sucursal", desc: "Cada restaurante con sus datos aislados y su propio QR." },
]

const FAQS = [
  { q: "¿Necesito tarjeta para probar?", a: "No. La prueba de 14 días es gratis y sin tarjeta. Solo pagas si decides quedarte." },
  { q: "¿Cuándo empiezan los 14 días?", a: "Cuando tú pulsas «Activar prueba», no al registrarte. Explora primero sin presión." },
  { q: "¿Qué pasa si no pago al vencer?", a: "Conservas tu cuenta, tu menú y tus datos. Solo se pausan los pedidos nuevos hasta que renueves. Tu QR no cambia." },
  { q: "¿Mis clientes necesitan instalar algo?", a: "No. Escanean el QR y piden desde el navegador, en Android y iPhone." },
  { q: "¿Puedo cancelar cuando quiera?", a: "Sí. Mensual o quincenal, sin contratos ni permanencia." },
]

export default function Home() {
  const router = useRouter()
  const [openFaq, setOpenFaq] = useState(null)

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-white">
      {/* Nav */}
      <nav className="max-w-7xl mx-auto flex items-center justify-between px-4 py-5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500">
            <ChefHat className="h-5 w-5 text-white" />
          </div>
          <span className="font-black text-lg">Restaurant Manager</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/login")} className="text-sm text-gray-300 hover:text-white px-3 py-2">
            Iniciar sesión
          </button>
          <button
            onClick={() => router.push("/register")}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-2.5 text-sm font-bold hover:scale-105 transition-transform"
          >
            Probar gratis
          </button>
        </div>
      </nav>

      {/* Hero */}
      <header className="max-w-7xl mx-auto px-4 pt-10 pb-16 text-center relative">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-amber-500/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-72 h-72 bg-orange-600/20 rounded-full blur-[120px] pointer-events-none" />
        <p className="inline-block text-xs font-semibold tracking-wide text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-full px-4 py-1.5 mb-6">
          14 DÍAS GRATIS · SIN TARJETA
        </p>
        <h1 className="text-4xl md:text-6xl font-black tracking-tight leading-tight mb-4">
          Tu restaurante recibiendo<br />pedidos por QR en minutos
        </h1>
        <p className="text-gray-400 text-base md:text-lg max-w-2xl mx-auto mb-8">
          Menú digital, pedidos en tiempo real, cocina organizada y chat con cada mesa.
          Sin hardware especial, sin instalaciones: solo el celular que ya tienes.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-4">
          <button
            onClick={() => router.push("/register")}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 text-base font-bold hover:scale-105 transition-transform"
          >
            Probar gratis 14 días <ArrowRight className="h-5 w-5" />
          </button>
          <button
            onClick={() => router.push("/demo")}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-600 px-8 py-4 text-base font-bold text-gray-200 hover:border-gray-400 transition-colors"
          >
            <Play className="h-5 w-5" /> Ver demo en vivo
          </button>
        </div>
        <p className="text-xs text-gray-500">Sin tarjeta · Listo en minutos · Cancela cuando quieras</p>
      </header>

      {/* Cómo funciona */}
      <section className="max-w-5xl mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-black text-center mb-8">De cero a vendiendo en 3 pasos</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {STEPS.map((s) => (
            <div key={s.n} className="rounded-2xl bg-white/5 border border-white/10 p-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 font-black text-lg mb-4">
                {s.n}
              </div>
              <h3 className="font-bold mb-1">{s.title}</h3>
              <p className="text-sm text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-black text-center mb-8">Todo tu restaurante en una app</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-2xl bg-white/5 border border-white/10 p-6 hover:border-amber-500/40 transition-colors">
              <f.icon className="h-8 w-8 text-amber-400 mb-3" />
              <h3 className="font-bold mb-1">{f.title}</h3>
              <p className="text-sm text-gray-400">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Planes */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-black text-center mb-2">Planes simples, sin letra pequeña</h2>
        <p className="text-center text-gray-400 text-sm mb-8">Empieza con 14 días gratis. Tu QR y tu menú no cambian nunca de plan.</p>
        <div className="grid md:grid-cols-2 gap-4">
          {[
            { name: "Mensual", price: "USD 9.99", per: "/mes", desc: "Para operar mes a mes, sin compromiso." },
            { name: "Quincenal", price: "USD 5.99", per: "/15 días", desc: "La puerta de entrada más barata." },
          ].map((p) => (
            <div key={p.name} className="rounded-2xl bg-white/5 border border-white/10 p-8 text-center">
              <h3 className="font-bold text-lg">{p.name}</h3>
              <p className="text-4xl font-black my-2">{p.price}<span className="text-base font-normal text-gray-400">{p.per}</span></p>
              <p className="text-sm text-gray-400 mb-6">{p.desc}</p>
              <ul className="text-sm text-left space-y-2 mb-6">
                {["Todo el sistema completo", "Mesas y QR ilimitados", "Soporte por WhatsApp"].map((f) => (
                  <li key={f} className="flex items-center gap-2 text-gray-300">
                    <Check className="h-4 w-4 text-green-400" /> {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => router.push("/register")}
                className="w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 py-3 font-bold hover:scale-[1.02] transition-transform"
              >
                Empezar prueba gratis
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-black text-center mb-8">Preguntas frecuentes</h2>
        <div className="space-y-2">
          {FAQS.map((f, i) => (
            <div key={i} className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between px-5 py-4 text-left font-semibold text-sm"
              >
                {f.q}
                <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${openFaq === i ? "rotate-180" : ""}`} />
              </button>
              {openFaq === i && <p className="px-5 pb-4 text-sm text-gray-400">{f.a}</p>}
            </div>
          ))}
        </div>
      </section>

      {/* CTA final + footer */}
      <section className="max-w-4xl mx-auto px-4 py-12 text-center">
        <h2 className="text-2xl md:text-3xl font-black mb-4">¿Listo para llenar tus mesas?</h2>
        <button
          onClick={() => router.push("/register")}
          className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-8 py-4 text-base font-bold hover:scale-105 transition-transform"
        >
          Crear mi restaurante gratis <ArrowRight className="h-5 w-5" />
        </button>
        <p className="mt-8 text-xs text-gray-600 flex items-center justify-center gap-4">
          <button onClick={() => router.push("/login")} className="hover:text-gray-300">Iniciar sesión</button>
          <span>·</span>
          <a href={waLink("Hola, quiero información sobre el sistema para mi restaurante")} target="_blank" rel="noreferrer" className="hover:text-gray-300">
            Hablar por WhatsApp
          </a>
        </p>
      </section>
    </div>
  )
}
