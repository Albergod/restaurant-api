"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { apiFetch, logout, getRole, getToken } from "@/lib/api"
import { User, LogOut, AlertCircle, Plus, Settings2, Layers, Package, Loader2 } from "lucide-react"
import ProductCard from "@/components/admin/ProductCard"
import ProductForm from "@/components/admin/ProductForm"
import CategoryForm from "@/components/admin/CategoryForm"
import DeleteDialog from "@/components/admin/DeleteDialog"

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
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)

  const [form, setForm] = useState({
    name: "", description: "", price: "", image_url: "", category_id: "",
    is_available: true, is_featured: false, is_promoted: false, discount_percentage: "",
  })

  const [catForm, setCatForm] = useState({ name: "" })

  useEffect(() => {
    const token = getToken()
    if (!token) { router.replace("/login"); return }
    if (getRole() !== "admin") { router.replace("/login"); return }
    setAuthorized(true)
  }, [router])

  const loadData = useCallback(async () => {
    try {
      const menuData = await apiFetch("/api/menu/")
      setMenu(menuData || [])
      setCategories(menuData || [])
      const allProducts = (menuData || []).flatMap(
        (c) => c.products?.map((p) => ({ ...p, category_name: c.name })) || [])
      setProducts(allProducts)
      setError(null)
    } catch (e) {
      if (e.message?.startsWith("401")) { logout(); router.replace("/login"); return }
      setError("Error al cargar el menú")
    } finally { setLoading(false) }
  }, [router])

  useEffect(() => { if (authorized) loadData() }, [authorized, loadData])

  function openNewProduct() {
    setEditingProduct(null)
    setForm({ name: "", description: "", price: "", image_url: "", category_id: categories[0]?.id || "", is_available: true, is_featured: false, is_promoted: false, discount_percentage: "" })
    setProductDialog(true)
  }

  function openEditProduct(product) {
    const discountPercentage = product.promo_price && product.price
      ? Number(((1 - product.promo_price / product.price) * 100).toFixed(2))
      : ""
    setEditingProduct(product)
    setForm({
      name: product.name, description: product.description || "", price: String(product.price),
      image_url: product.image_url || "", category_id: product.category_id || "",
      is_available: product.is_available, is_featured: product.is_featured, is_promoted: product.is_promoted,
      discount_percentage: String(discountPercentage),
    })
    setProductDialog(true)
  }

  async function saveProduct() {
    try {
      const price = Number(form.price)
      const discountPercentage = Number(form.discount_percentage)
      if (form.is_promoted && (!discountPercentage || discountPercentage <= 0 || discountPercentage >= 100)) {
        setError("El porcentaje de descuento debe ser mayor que 0 y menor que 100")
        return
      }
      const promoPrice = form.is_promoted
        ? Math.round(price * (1 - discountPercentage / 100) * 100) / 100
        : null
      const body = {
        name: form.name, description: form.description || null, price,
        image_url: form.image_url || null, category_id: Number(form.category_id),
        is_available: form.is_available, is_featured: form.is_featured, is_promoted: form.is_promoted,
        promo_price: promoPrice,
      }
      if (editingProduct) {
        await apiFetch(`/api/menu/products/${editingProduct.id}`, { method: "PATCH", body: JSON.stringify(body) })
      } else {
        await apiFetch("/api/menu/products", { method: "POST", body: JSON.stringify(body) })
      }
      setProductDialog(false)
      loadData()
    } catch (e) {
      if (e.message?.startsWith("401")) { logout(); router.replace("/login"); return }
      setError("Error al guardar el producto")
    }
  }

  async function saveCategory() {
    try {
      await apiFetch("/api/menu/categories", { method: "POST", body: JSON.stringify({ name: catForm.name }) })
      setCategoryDialog(false)
      setCatForm({ name: "" })
      loadData()
    } catch (e) {
      if (e.message?.startsWith("401")) { logout(); router.replace("/login"); return }
      setError("Error al guardar la categoría")
    }
  }

  async function deleteProduct(productId) {
    try {
      await apiFetch(`/api/menu/products/${productId}`, { method: "DELETE" })
      setDeleteTarget(null)
      loadData()
    } catch (e) {
      if (e.message?.startsWith("401")) { logout(); router.replace("/login"); return }
      setError("Error al eliminar el producto")
    }
  }

  async function deleteCategory(categoryId) {
    try {
      await apiFetch(`/api/menu/categories/${categoryId}`, { method: "DELETE" })
      setDeleteCategoryTarget(null)
      loadData()
    } catch (e) {
      if (e.message?.startsWith("401")) { logout(); router.replace("/login"); return }
      setError("Error al eliminar la categoría")
    }
  }

  async function toggleField(productId, field) {
    const product = products.find((p) => p.id === productId)
    if (!product) return
    try {
      await apiFetch(`/api/menu/products/${productId}`, { method: "PATCH", body: JSON.stringify({ [field]: !product[field] }) })
      loadData()
    } catch (e) {
      if (e.message?.startsWith("401")) { logout(); router.replace("/login"); return }
      setError("Error al actualizar el producto")
    }
  }

  function handleLogout() { logout(); router.replace("/login") }

  if (!authorized || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fafafa]">
        <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
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
            <p className="text-sm text-gray-500">Gestión de categorías y productos</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {role && (
            <div className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600">
              <User className="h-3.5 w-3.5" />{role}
            </div>
          )}
          <button onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50">
            <LogOut className="h-4 w-4" />Salir
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-6 flex items-center gap-2 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" /><span>{error}</span>
        </div>
      )}

      <div className="mb-6 flex gap-2">
        <button onClick={() => setActiveTab("products")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "products" ? "bg-amber-500 text-white shadow-sm" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
          <Package className="h-4 w-4" />Productos
        </button>
        <button onClick={() => setActiveTab("categories")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${activeTab === "categories" ? "bg-amber-500 text-white shadow-sm" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>
          <Layers className="h-4 w-4" />Categorías
        </button>
      </div>

      {activeTab === "categories" ? (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Categorías</h2>
            <button onClick={() => { setCatForm({ name: "" }); setCategoryDialog(true) }}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-600">
              <Plus className="h-4 w-4" />Nueva
            </button>
          </div>
          {categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
              <Layers className="mb-2 h-8 w-8 text-gray-200" /><p className="text-sm text-gray-400">Sin categorías</p>
            </div>
          ) : (
            <div className="space-y-2">
              {categories.map((cat) => (
                <div key={cat.id} className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-3">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-100">
                      <Layers className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{cat.name}</p>
                      <p className="text-xs text-gray-400">{(cat.products || []).length} productos</p>
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
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Productos</h2>
            <button onClick={openNewProduct}
              className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-amber-600">
              <Plus className="h-4 w-4" />Nuevo producto
            </button>
          </div>

          {categories.length > 0 && (
            <div className="mb-6 flex gap-2 overflow-x-auto pb-2 hide-scrollbar">
              <button onClick={() => setCategoryFilter(null)}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${categoryFilter === null ? "bg-gray-900 text-white shadow-sm" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>Todas</button>
              {categories.map((cat) => (
                <button key={cat.id} onClick={() => setCategoryFilter(cat.id)}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${categoryFilter === cat.id ? "bg-gray-900 text-white shadow-sm" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}>{cat.name}</button>
              ))}
            </div>
          )}

          {products.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 py-16 text-center">
              <Package className="mb-2 h-8 w-8 text-gray-200" /><p className="text-sm text-gray-400">Sin productos</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {products.filter((p) => !categoryFilter || p.category_id === categoryFilter).map((product) => (
                <ProductCard key={product.id} product={product}
                  onToggle={toggleField} onEdit={openEditProduct} onDelete={setDeleteTarget} />
              ))}
            </div>
          )}
        </div>
      )}

      <ProductForm form={form} onChange={setForm} categories={categories}
        productDialog={productDialog} editingProduct={editingProduct}
        onSave={saveProduct} onClose={() => setProductDialog(false)} onError={setError} />

      <CategoryForm catForm={catForm} onChange={setCatForm} categories={categories}
        categoryDialog={categoryDialog}
        onSave={saveCategory} onClose={() => setCategoryDialog(false)}
        onDelete={setDeleteCategoryTarget} />

      <DeleteDialog item={deleteTarget} title="Eliminar producto" onConfirm={deleteProduct} onClose={() => setDeleteTarget(null)} />

      <DeleteDialog item={deleteCategoryTarget} title="Eliminar categoría"
        description="Los productos de esta categoría también dejaran de mostrarse. Esta accion no se puede deshacer."
        onConfirm={deleteCategory} onClose={() => setDeleteCategoryTarget(null)} />
    </div>
  )
}
