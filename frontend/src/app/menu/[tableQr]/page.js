"use client"

import { useState, useEffect, useMemo } from "react"
import { apiFetch } from "@/lib/api"
import { useParams, useRouter } from "next/navigation"
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  UtensilsCrossed,
  Tag,
  Flame,
  AlertCircle,
  Send,
  X,
  Search,
  Loader,
  Image,
} from "lucide-react"

export default function MenuPage() {
  const params = useParams()
  const router = useRouter()
  const tableQr = params.tableQr

  const [menu, setMenu] = useState([])
  const [featured, setFeatured] = useState([])
  const [promotions, setPromotions] = useState([])
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

  const allProducts = useMemo(() => {
    return menu.flatMap((cat) =>
      (cat.products || []).map((p) => ({ ...p, category_name: cat.name }))
    )
  }, [menu])

  const filteredProducts = useMemo(() => {
    let list = allProducts

    if (activeCategory) {
      list = list.filter((p) => p.category_id === activeCategory)
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description && p.description.toLowerCase().includes(q))
      )
    }

    return list
  }, [allProducts, activeCategory, searchQuery])

  const cartCount = cart.reduce((s, i) => s + i.quantity, 0)
  const cartTotal = cart.reduce((s, i) => s + i.quantity * Number(i.price), 0)

  function addToCart(product) {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id)
      if (existing) {
        return prev.map((i) =>
          i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      }
      return [...prev, { ...product, quantity: 1, note: "" }]
    })
  }

  function updateQty(id, qty) {
    setCart((prev) =>
      qty <= 0
        ? prev.filter((i) => i.id !== id)
        : prev.map((i) => (i.id === id ? { ...i, quantity: qty } : i))
    )
  }

  function updateNote(id, note) {
    setCart((prev) => prev.map((i) => (i.id === id ? { ...i, note } : i)))
  }

  function removeItem(id) {
    setCart((prev) => prev.filter((i) => i.id !== id))
  }

  async function submitOrder() {
    if (cart.length === 0) return
    setSubmitting(true)
    try {
      const items = cart.map((i) => ({
        product_id: i.id,
        quantity: i.quantity,
        observations: i.note || null,
      }))
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
          <button 
            onClick={() => window.location.reload()}
            className="w-full bg-amber-500 hover:bg-amber-600 text-white font-medium py-3 px-4 rounded-xl transition-all"
          >
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
              <p className="text-xs font-medium text-amber-600 bg-amber-100/50 px-2 py-0.5 rounded-full inline-block mt-0.5">Mesa {tableQr}</p>
            </div>
          </div>
          <button
            onClick={() => setCartOpen(true)}
            className="relative flex h-10 items-center gap-2 rounded-xl border border-orange-100 bg-white/80 px-3.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-white hover:scale-105 active:scale-95"
          >
            <ShoppingCart className="h-4 w-4 text-orange-500" />
            <span className="hidden sm:inline">Pedido</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-500 px-1.5 text-[10px] font-bold text-white shadow-sm ring-2 ring-white animate-fade-in">
                {cartCount}
              </span>
            )}
          </button>
        </div>
        
        {/* Search Bar */}
        <div className="mx-auto max-w-2xl px-4 pb-3">
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
             <input 
               type="text" 
               placeholder="Buscar en el menú..." 
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               className="w-full bg-white/60 border border-gray-200/60 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-300 focus:bg-white transition-all shadow-inner"
             />
             {searchQuery && (
               <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                 <X className="h-3.5 w-3.5" />
               </button>
             )}
           </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl animate-fade-in">
        {!searchQuery && promotions.length > 0 && (
          <section className="px-4 pt-5">
            <div className="rounded-2xl bg-gradient-to-r from-amber-500 to-orange-500 p-4 shadow-lg shadow-orange-200/50 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-20">
                <Tag className="h-24 w-24 transform rotate-12" />
              </div>
              <div className="relative z-10">
                <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-amber-50">
                  <Tag className="h-4 w-4" />
                  Promociones
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x hide-scrollbar">
                  {promotions.map((p) => (
                    <div
                      key={p.id}
                      className="snap-start flex shrink-0 flex-col justify-between rounded-xl bg-white/20 backdrop-blur-md p-3 border border-white/30 text-white min-w-[160px]"
                    >
                      <div>
                        <p className="font-bold text-sm truncate">{p.name}</p>
                        <p className="text-xs text-amber-100 line-through mt-1">${Number(p.price).toFixed(2)}</p>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="font-black text-lg">${Number(p.promo_price).toFixed(2)}</span>
                        <button onClick={() => addToCart(p)} className="bg-white text-orange-600 p-1.5 rounded-lg hover:bg-orange-50 transition-colors">
                           <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}

        {!searchQuery && featured.length > 0 && (
          <section className="px-4 pt-6">
            <div className="mb-3 flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-orange-100 text-orange-500">
                <Flame className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
                Destacados
              </h2>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 snap-x hide-scrollbar px-1">
              {featured.map((p, index) => (
                <div
                  key={p.id}
                  style={{ animationDelay: `${index * 50}ms` }}
                  className="snap-start shrink-0 glass-card rounded-2xl p-4 flex flex-col justify-between w-[160px] animate-slide-up"
                >
                  <div>
                    <div className="h-24 w-full bg-gradient-to-br from-gray-100 to-gray-200 rounded-xl mb-3 flex items-center justify-center shadow-inner">
                       <UtensilsCrossed className="h-8 w-8 text-gray-300" />
                    </div>
                    <p className="font-bold text-gray-900 text-sm line-clamp-2 leading-tight">{p.name}</p>
                    <p className="mt-1 text-[10px] uppercase font-bold text-amber-500">{p.category_name}</p>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <p className="font-black text-gray-900">${Number(p.price).toFixed(2)}</p>
                    <button
                      onClick={() => addToCart(p)}
                      className="flex h-8 w-8 items-center justify-center rounded-xl bg-gray-900 text-white transition-all hover:bg-gray-800 hover:scale-110 active:scale-95 shadow-md"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="sticky top-[116px] z-10 px-4 py-3 bg-gradient-to-b from-amber-50/95 via-amber-50/95 to-transparent backdrop-blur-sm">
          <div className="flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
            <button
              onClick={() => { setActiveCategory(null); setSearchQuery("") }}
              className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                activeCategory === null && !searchQuery
                  ? "bg-gray-900 text-white shadow-md scale-105"
                  : "glass text-gray-600 hover:bg-white/90"
              }`}
            >
              Todas
            </button>
            {menu.map((cat) => (
              <button
                key={cat.id}
                onClick={() => { setActiveCategory(cat.id); setSearchQuery(""); }}
                className={`shrink-0 rounded-xl px-4 py-2 text-sm font-bold transition-all ${
                  activeCategory === cat.id && !searchQuery
                    ? "bg-gray-900 text-white shadow-md scale-105"
                    : "glass text-gray-600 hover:bg-white/90"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </section>

        <section className="px-4 pb-8">
          {searchQuery && (
            <h2 className="mb-4 text-sm font-bold text-gray-500">
              Resultados para "{searchQuery}"
            </h2>
          )}
          {filteredProducts.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-center opacity-50">
              <Search className="h-12 w-12 mb-3 text-gray-400" />
              <p className="text-gray-500 font-medium">No se encontraron productos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredProducts.map((product, index) => {
                const hasPromo = product.promo_price && product.promo_price < product.price
                return (
                  <div
                    key={product.id}
                    style={{ animationDelay: `${index * 50}ms` }}
                    className="glass-card rounded-2xl overflow-hidden flex flex-col animate-slide-up"
                  >
                    <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                      <Image className="h-10 w-10 text-gray-300" />
                    </div>
                    <div className="flex flex-col flex-1 p-3 gap-1.5">
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="font-bold text-gray-900 text-sm leading-tight line-clamp-2 flex-1">
                          {product.name}
                        </h3>
                        {product.is_available === false && (
                          <span className="shrink-0 rounded-full bg-red-100 px-1.5 py-0.5 text-[8px] uppercase font-black text-red-600">
                            Agotado
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] uppercase font-bold text-amber-500 truncate">
                        {product.category_name}
                      </p>
                      {product.description && (
                        <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                          {product.description}
                        </p>
                      )}
                      <div className="mt-auto flex items-center justify-between pt-2">
                        <div>
                          <span className={`text-base font-black ${hasPromo ? "text-red-500" : "text-gray-900"}`}>
                            ${Number(hasPromo ? product.promo_price : product.price).toFixed(2)}
                          </span>
                          {hasPromo && (
                            <span className="ml-1 text-[10px] font-bold text-gray-400 line-through">
                              ${Number(product.price).toFixed(2)}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => addToCart(product)}
                          disabled={product.is_available === false}
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-amber-500 text-white transition-all hover:bg-amber-600 hover:scale-110 active:scale-95 disabled:opacity-40 disabled:hover:scale-100 shadow-sm shadow-amber-200"
                        >
                          <Plus className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </main>

      {/* Cart Modal / Drawer */}
      {cartOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm animate-fade-in"
            onClick={() => setCartOpen(false)}
          />
          <div className="relative w-full max-w-lg max-h-[90vh] bg-white sm:rounded-3xl rounded-t-3xl shadow-2xl flex flex-col animate-slide-up overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 to-orange-500"></div>
            
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 text-orange-500 rounded-xl">
                  <ShoppingCart className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 leading-tight">Tu pedido</h2>
                  <p className="text-xs font-medium text-gray-500">{cartCount} {cartCount === 1 ? 'artículo' : 'artículos'}</p>
                </div>
              </div>
              <button
                onClick={() => setCartOpen(false)}
                className="p-2 rounded-full hover:bg-gray-100 text-gray-400 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-4 bg-gray-50/50">
              {cart.length === 0 ? (
                <div className="py-16 flex flex-col items-center justify-center text-center opacity-50">
                  <ShoppingCart className="h-16 w-16 mb-4 text-gray-300" />
                  <p className="text-gray-500 font-medium text-lg">Tu carrito está vacío</p>
                  <p className="text-gray-400 text-sm mt-1">¡Agrega algo delicioso!</p>
                  <button onClick={() => setCartOpen(false)} className="mt-6 text-amber-600 font-bold hover:underline">Volver al menú</button>
                </div>
              ) : (
                <div className="space-y-4">
                  {cart.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-gray-900 text-sm truncate">{item.name}</h4>
                          <p className="text-xs font-medium text-gray-500 mt-0.5">${Number(item.price).toFixed(2)} c/u</p>
                          <textarea
                            value={item.note || ""}
                            onChange={(e) => updateNote(item.id, e.target.value)}
                            placeholder="Instrucciones especiales (opcional)"
                            className="mt-3 w-full rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white transition-all resize-none"
                            rows={1}
                          />
                        </div>
                        <div className="flex flex-col items-end gap-3">
                          <span className="font-black text-gray-900">${(Number(item.price) * item.quantity).toFixed(2)}</span>
                          <div className="flex items-center gap-2 bg-gray-50 rounded-xl border border-gray-200 p-1">
                            <button
                              onClick={() => updateQty(item.id, item.quantity - 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm hover:text-orange-500 transition-colors disabled:opacity-50"
                            >
                              {item.quantity <= 1 ? <Trash2 className="h-3.5 w-3.5 text-red-400" /> : <Minus className="h-3.5 w-3.5" />}
                            </button>
                            <span className="w-4 text-center text-sm font-bold text-gray-900">{item.quantity}</span>
                            <button
                              onClick={() => updateQty(item.id, item.quantity + 1)}
                              className="w-7 h-7 flex items-center justify-center rounded-lg bg-white text-gray-600 shadow-sm hover:text-green-500 transition-colors"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {cart.length > 0 && (
              <div className="px-6 py-5 bg-white border-t border-gray-100 shadow-[0_-10px_20px_-10px_rgba(0,0,0,0.05)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-gray-500 font-medium">Total a pagar</span>
                  <span className="text-2xl font-black text-gray-900">${cartTotal.toFixed(2)}</span>
                </div>
                <button
                  onClick={submitOrder}
                  disabled={submitting}
                  className="relative w-full flex items-center justify-center gap-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-orange-200 hover:shadow-orange-300 transition-all active:scale-[0.98] disabled:opacity-70 disabled:active:scale-100 overflow-hidden"
                >
                  {submitting ? (
                    <>
                      <Loader className="h-5 w-5 animate-spin" />
                      Procesando...
                    </>
                  ) : (
                    <>
                      <Send className="h-5 w-5" />
                      Enviar pedido a cocina
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* CSS to hide scrollbar for horizontal scrolls but keep functionality */}
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  )
}
