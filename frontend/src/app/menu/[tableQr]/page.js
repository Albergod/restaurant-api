"use client"

import { useState, useEffect, useMemo } from "react"
import { apiFetch } from "@/lib/api"
import { useParams, useRouter } from "next/navigation"
import { UtensilsCrossed, ShoppingCart, AlertCircle, Search, X } from "lucide-react"
import ProductCard from "@/components/menu/ProductCard"
import CartDrawer from "@/components/menu/CartDrawer"
import PromotionsCarousel from "@/components/menu/PromotionsCarousel"
import FeaturedCarousel from "@/components/menu/FeaturedCarousel"

export default function MenuPage() {
  const params = useParams()
  const router = useRouter()
  const tableQr = params.tableQr

  const [menu, setMenu] = useState([])
  const [featured, setFeatured] = useState([])
  const [promotions, setPromotions] = useState([])
  const [tableInfo, setTableInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cart, setCart] = useState([])
  const [cartOpen, setCartOpen] = useState(false)
  const [activeCategory, setActiveCategory] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    async function load() {
      try {
        const [menuData, featuredData, promoData] = await Promise.all([
          apiFetch("/api/menu/"),
          apiFetch("/api/menu/featured"),
          apiFetch("/api/menu/promotions"),
        ])
        setMenu(menuData)
        setFeatured(featuredData)
        setPromotions(promoData)
        if (menuData.length > 0) setActiveCategory(menuData[0].id)
      } catch (e) {
        setError("Error al cargar el menú")
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  useEffect(() => {
    if (!tableQr) return
    fetch(`/api/menu/table-by-qr/${tableQr}`)
      .then(r => r.ok && r.json())
      .then(data => setTableInfo(data))
      .catch(() => {})
  }, [tableQr])

  const allProducts = useMemo(() =>
    menu.flatMap((cat) =>
      (cat.products || []).map((p) => ({ ...p, category_name: cat.name }))
    ), [menu])

  const filteredProducts = useMemo(() => {
    let list = allProducts
    if (activeCategory) list = list.filter((p) => p.category_id === activeCategory)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter((p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description && p.description.toLowerCase().includes(q)))
    }
    return list
  }, [allProducts, activeCategory, searchQuery])

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => s + i.quantity * Number(i.price), 0)

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) return prev.map((i) => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i)
      return [...prev, { ...product, quantity: 1, note: "" }]
    })
  }

  function updateQty(id, qty) {
    setCart((prev) =>
      qty <= 0 ? prev.filter((i) => i.id !== id) : prev.map((i) => i.id === id ? { ...i, quantity: qty } : i))
  }

  function updateNote(id, note) {
    setCart((prev) => prev.map((i) => i.id === id ? { ...i, note } : i))
  }

  async function submitOrder() {
    if (cart.length === 0) return
    setSubmitting(true)
    try {
      const items = cart.map((i) => ({ product_id: i.id, quantity: i.quantity, observations: i.note || null }))
      const order = await apiFetch("/api/orders/", {
        method: "POST",
        body: JSON.stringify({ table_qr: tableQr, items }),
      })
      setCart([])
      setCartOpen(false)
      router.push(`/order/${order.id}`)
    } catch (e) {
      setError("Error al crear el pedido")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
        <div className="flex flex-col items-center animate-fade-in">
          <UtensilsCrossed className="h-12 w-12 text-amber-500 animate-bounce mb-4" />
          <p className="text-gray-500 font-medium">Preparando el menú...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100 p-4">
        <div className="glass-card p-8 rounded-2xl flex flex-col items-center justify-center text-center max-w-sm w-full">
          <div className="h-16 w-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">¡Ups!</h2>
          <p className="text-sm font-medium text-gray-600 mb-6">{error}</p>
          <button onClick={() => window.location.reload()} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 px-4 rounded-xl transition-all">
            Intentar de nuevo
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 pb-28 selection:bg-amber-200">
      <header className="sticky top-0 z-20 glass backdrop-blur-xl border-b border-white/40">
        <div className="mx-auto max-w-2xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-orange-200">
              <UtensilsCrossed className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">Menú</h1>
              <p className="text-xs font-medium text-amber-600 bg-amber-100/50 px-2 py-0.5 rounded-full inline-block mt-0.5">
                Mesa {tableInfo ? `#${tableInfo.number}` : `#${tableQr.slice(0, 4)}...`}
              </p>
            </div>
          </div>
          <button onClick={() => setCartOpen(true)} className="relative flex h-10 items-center gap-2 rounded-xl border border-orange-100 bg-white/80 px-3.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95">
            <ShoppingCart className="h-4 w-4 text-orange-500" />
            <span className="hidden sm:inline">Pedido</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-fade-in">
                {cartCount}
              </span>
            )}
          </button>
        </div>
        
        <div className="mx-auto max-w-2xl px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Buscar en el menú..." value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white/60 border border-gray-200/60 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:bg-white transition-all shadow-inner" />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl animate-fade-in">
        {!searchQuery && <PromotionsCarousel promotions={promotions} onAdd={addToCart} />}
        {!searchQuery && <FeaturedCarousel featured={featured} onAdd={addToCart} />}

        <section className="sticky top-[116px] z-10 px-4 py-3 bg-gradient-to-b from-amber-50/95 via-amber-50/95 to-transparent backdrop-blur-sm">
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            <button onClick={() => { setActiveCategory(null); setSearchQuery("") }}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition-all ${activeCategory === null && !searchQuery ? "bg-gray-900 text-white shadow-md scale-105" : "glass text-gray-600 hover:bg-white/90"}`}>
              Todas
            </button>
            {menu.map((cat) => (
              <button key={cat.id} onClick={() => { setActiveCategory(cat.id); setSearchQuery(""); }}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition-all ${activeCategory === cat.id && !searchQuery ? "bg-gray-900 text-white shadow-md scale-105" : "glass text-gray-600 hover:bg-white/90"}`}>
                {cat.name}
              </button>
            ))}
          </div>
        </section>

        <section className="px-4 pb-8">
          {searchQuery && <h2 className="mb-4 text-sm font-bold text-gray-500">Resultados para &quot;{searchQuery}&quot;</h2>}
          {filteredProducts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
              <Search className="h-12 w-12 mb-3 text-gray-400" />
              <p className="text-gray-500 font-medium">No se encontraron productos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} index={index} onAdd={addToCart} />
              ))}
            </div>
          )}
        </section>
      </main>

      <CartDrawer cart={cart} cartOpen={cartOpen} cartCount={cartCount} cartTotal={cartTotal}
        onClose={() => setCartOpen(false)} onUpdateQty={updateQty} onUpdateNote={updateNote}
        onSubmit={submitOrder} submitting={submitting} />

      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  )
}
