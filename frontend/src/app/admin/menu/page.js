"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { apiFetch, logout, getRole, getToken } from "@/lib/api"
import {
  User,
  LogOut,
  AlertCircle,
  Plus,
  Settings2,
  Layers,
  Package,
  Pencil,
  Eye,
  EyeOff,
  Star,
  Percent,
  Loader2,
  Image,
} from "lucide-react"

export default function AdminMenuPage() {
  const router = useRouter()
  const [authorized, setAuthorized] = useState(false)
  const [menu, setMenu] = useState([])
  const [categories, setCategories] = useState([])
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [role] = useState(typeof window !== "undefined" ? getRole() : "")
  const [activeTab, setActiveTab] = useState("products")
  const [categoryFilter, setCategoryFilter] = useState(null)

  const [productDialog, setProductDialog] = useState(false)
  const [categoryDialog, setCategoryDialog] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  const [form, setForm] = useState({
    name: "",
    description: "",
    price: "",
    category_id: "",
    is_available: true,
    is_featured: false,
    is_promoted: false,
  })

  const [catForm, setCatForm] = useState({ name: "" })

  useEffect(() => {
    const token = getToken()
    if (!token) {
      router.replace("/login")
      return
    }
    const userRole = getRole()
    if (userRole !== "admin") {
      router.replace("/login")
      return
    }
    setAuthorized(true) // eslint-disable-line react-hooks/set-state-in-effect
  }, [router])

  const loadData = useCallback(async () => {
    try {
      const menuData = await apiFetch("/api/menu/")
      setMenu(menuData || [])
      setCategories(menuData || [])
      const allProducts =
        (menuData || []).flatMap(
          (c) => c.products?.map((p) => ({ ...p, category_name: c.name })) || []
        ) || []
      setProducts(allProducts)
      setError(null)
    } catch (e) {
      if (e.message?.startsWith("401")) {
        logout()
        router.replace("/login")
        return
      }
      setError("Error al cargar el menú")
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (!authorized) return
    loadData() // eslint-disable-line react-hooks/set-state-in-effect
  }, [authorized, loadData])

  function openNewProduct() {
    setEditingProduct(null)
    setForm({
      name: "",
      description: "",
      price: "",
      category_id: categories[0]?.id || "",
      is_available: true,
      is_featured: false,
      is_promoted: false,
    })
    setProductDialog(true)
  }

  function openEditProduct(product) {
    setEditingProduct(product)
    setForm({
      name: product.name,
      description: product.description || "",
      price: String(product.price),
      category_id: product.category_id || "",
      is_available: product.is_available,
      is_featured: product.is_featured,
      is_promoted: product.is_promoted,
    })
    setProductDialog(true)
  }

  async function saveProduct() {
    try {
      const body = {
        name: form.name,
        description: form.description || null,
        price: Number(form.price),
        category_id: Number(form.category_id),
        is_available: form.is_available,
        is_featured: form.is_featured,
        is_promoted: form.is_promoted,
      }
      if (editingProduct) {
        await apiFetch(`/api/menu/products/${editingProduct.id}`, {
          method: "PATCH",
          body: JSON.stringify(body),
        })
      } else {
        await apiFetch("/api/menu/products", {
          method: "POST",
          body: JSON.stringify(body),
        })
      }
      setProductDialog(false)
      loadData()
    } catch (e) {
      if (e.message?.startsWith("401")) {
        logout()
        router.replace("/login")
        return
      }
      setError("Error al guardar el producto")
    }
  }

  async function saveCategory() {
    try {
      await apiFetch("/api/menu/categories", {
        method: "POST",
        body: JSON.stringify({ name: catForm.name }),
      })
      setCategoryDialog(false)
      setCatForm({ name: "" })
      loadData()
    } catch (e) {
      if (e.message?.startsWith("401")) {
        logout()
        router.replace("/login")
        return
      }
      setError("Error al guardar la categoría")
    }
  }

  async function toggleField(productId, field) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    try {
      await apiFetch(`/api/menu/products/${productId}`, {
        method: "PATCH",
        body: JSON.stringify({ [field]: !product[field] }),
      })
      loadData()
    } catch (e) {
      if (e.message?.startsWith("401")) {
        logout()
        router.replace("/login")
        return
      }
      setError("Error al actualizar el producto")
    }
  }

  function handleLogout() {
    logout()
    router.replace("/login")
  }

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 w-48 rounded-lg bg-gray-100" />
          <div className="flex gap-2">
            <div className="h-9 w-32 rounded-lg bg-gray-100" />
            <div className="h-9 w-36 rounded-lg bg-gray-100" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100" />
          ))}
        </div>
      </div>
    )
  }

  if (error && !loading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <AlertCircle className="mb-3 h-10 w-10 text-red-400" />
          <p className="mb-4 text-sm font-medium text-red-600">{error}</p>
          <button
            onClick={loadData}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Reintentar
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500 shadow-lg shadow-amber-200">
            <Settings2 className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin — Menú</h1>
            <p className="text-sm text-gray-500">
              Gestión de categorías y productos
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {role && (
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
              <User className="h-3.5 w-3.5" />
              {role}
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            Salir
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="mb-6 flex gap-2">
        <button
          onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "products"
              ? "bg-amber-500 text-white shadow-sm"
              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Package className="h-4 w-4" />
          Productos
        </button>
        <button
          onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "categories"
              ? "bg-amber-500 text-white shadow-sm"
              : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Layers className="h-4 w-4" />
          Categorías
        </button>
      </div>

      {activeTab === "categories" ? (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Categorías
            </h2>
            <button
              onClick={() => {
                setCatForm({ name: "" })
                setCategoryDialog(true)
              }}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
            >
              <Plus className="h-4 w-4" />
              Nueva
            </button>
          </div>
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
              <Layers className="mb-2 h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-400">Sin categorías</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                      <Layers className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {cat.name}
                      </p>
                      <p className="text-xs text-gray-400">
                        {(cat.products || []).length} productos
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Productos
            </h2>
            <button
              onClick={openNewProduct}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-600"
            >
              <Plus className="h-4 w-4" />
              Nuevo producto
            </button>
          </div>

          {categories.length > 0 && (
            <div className="mb-6 flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
              <button
                onClick={() => setCategoryFilter(null)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  categoryFilter === null
                    ? "bg-gray-900 text-white shadow-sm"
                    : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                Todas
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                    categoryFilter === cat.id
                      ? "bg-gray-900 text-white shadow-sm"
                      : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
              <Package className="mb-2 h-8 w-8 text-gray-200" />
              <p className="text-sm text-gray-400">Sin productos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {products
                .filter((p) => !categoryFilter || p.category_id === categoryFilter)
                .map((product) => (
                <div
                  key={product.id}
                  className="rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md overflow-hidden flex flex-col"
                >
                  <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                    <Image className="h-10 w-10 text-gray-300" />
                  </div>
                  <div className="p-3 flex flex-col flex-1 gap-1.5">
                    <div className="flex items-start justify-between gap-1">
                      <p className="text-sm font-bold text-gray-900 leading-tight truncate flex-1">
                        {product.name}
                      </p>
                      {product.is_available === false && (
                        <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-500">
                          Oculto
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] font-medium text-gray-400 truncate">
                      {product.category_name || "Sin categoría"}
                    </p>
                    <p className="text-base font-black text-gray-900">
                      ${Number(product.price).toFixed(2)}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-1">
                      <div className="flex gap-1">
                        <button
                          onClick={() => toggleField(product.id, "is_available")}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
                            product.is_available
                              ? "bg-green-100 text-green-600 hover:bg-green-200"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          }`}
                          title={product.is_available ? "Visible" : "Oculto"}
                        >
                          {product.is_available ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          onClick={() => toggleField(product.id, "is_featured")}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
                            product.is_featured
                              ? "bg-orange-100 text-orange-600 hover:bg-orange-200"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          }`}
                          title={product.is_featured ? "Destacado" : "Destacar"}
                        >
                          <Star className={`h-3.5 w-3.5 ${product.is_featured ? "fill-orange-500" : ""}`} />
                        </button>
                        <button
                          onClick={() => toggleField(product.id, "is_promoted")}
                          className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${
                            product.is_promoted
                              ? "bg-red-100 text-red-600 hover:bg-red-200"
                              : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                          }`}
                          title={product.is_promoted ? "En promo" : "En promoción"}
                        >
                          <Percent className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <button
                        onClick={() => openEditProduct(product)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {categoryDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setCategoryDialog(false)}
          />
          <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">
              Nueva categoría
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Nombre
                </label>
                <input
                  value={catForm.name}
                  onChange={(e) => setCatForm({ name: e.target.value })}
                  placeholder="Ej: Bebidas"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setCategoryDialog(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveCategory}
                disabled={!catForm.name}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {productDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => setProductDialog(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-gray-900">
              {editingProduct ? "Editar producto" : "Nuevo producto"}
            </h3>
            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Nombre
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Nombre del producto"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-gray-700">
                  Descripción
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                  placeholder="Descripción opcional"
                  rows={2}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Precio
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="0.00"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700">
                    Categoría
                  </label>
                  <select
                    value={form.category_id}
                    onChange={(e) =>
                      setForm({ ...form, category_id: e.target.value })
                    }
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                  >
                    <option value="">Seleccionar</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={() => setProductDialog(false)}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={saveProduct}
                disabled={!form.name || !form.price}
                className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {editingProduct ? "Guardar cambios" : "Crear producto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
