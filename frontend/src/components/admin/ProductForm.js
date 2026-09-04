"use client"

import { getImageUrl, getToken } from "@/lib/api"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"

export default function ProductForm({ form, onChange, categories, productDialog, editingProduct, onSave, onClose, onError }) {
  if (!productDialog) return null

  const price = Number(form.price)
  const discountPercentage = Number(form.discount_percentage)
  const promoPrice = price > 0 && discountPercentage > 0 && discountPercentage < 100
    ? Math.round(price * (1 - discountPercentage / 100) * 100) / 100
    : null

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    try {
      const res = await fetch(`${API_URL}/api/uploads/`, {
        method: "POST",
        headers: { Authorization: `Bearer ${getToken()}` },
        body: formData,
      })
      if (!res.ok) throw new Error("Error al subir")
      const data = await res.json()
      onChange({ ...form, image_url: data.url })
    } catch {
      onError?.("Error al subir la imagen")
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-gray-900">{editingProduct ? "Editar producto" : "Nuevo producto"}</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre</label>
            <input value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="Nombre del producto"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Descripción</label>
            <textarea value={form.description} onChange={(e) => onChange({ ...form, description: e.target.value })}
              placeholder="Descripción opcional" rows={2}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Imagen</label>
            <div className="flex items-center gap-3">
              <input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleFileUpload}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-amber-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-amber-700 hover:file:bg-amber-200" />
              {form.image_url && (
                <button type="button" onClick={() => onChange({ ...form, image_url: "" })}
                  className="shrink-0 rounded-lg border border-red-200 px-2.5 py-2 text-xs font-medium text-red-500 hover:bg-red-50">Quitar</button>
              )}
            </div>
            {form.image_url && (
              <img src={getImageUrl(form.image_url)} alt="Vista previa" className="mt-2 h-20 w-20 rounded-lg border border-gray-200 object-cover" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Precio</label>
              <input type="number" step="0.01" value={form.price} onChange={(e) => onChange({ ...form, price: e.target.value })}
                placeholder="0.00"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Categoría</label>
              <select value={form.category_id} onChange={(e) => onChange({ ...form, category_id: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100">
                <option value="">Seleccionar</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-gray-200 p-3">
            <input type="checkbox" checked={form.is_promoted}
              onChange={(e) => onChange({ ...form, is_promoted: e.target.checked, discount_percentage: e.target.checked ? form.discount_percentage : "" })}
              className="h-4 w-4 accent-amber-500" />
            <div>
              <span className="block text-sm font-medium text-gray-700">Producto en promoción</span>
              <span className="block text-xs text-gray-400">Mostrar el precio con descuento en el catálogo</span>
            </div>
          </label>
          {form.is_promoted && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Porcentaje de descuento</label>
              <div className="relative">
                <input type="number" min="0.01" max="99.99" step="0.01" value={form.discount_percentage}
                  onChange={(e) => onChange({ ...form, discount_percentage: e.target.value })}
                  placeholder="Ej. 20"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-9 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
                <span className="absolute right-3 top-2 text-sm text-gray-400">%</span>
              </div>
              {promoPrice !== null && (
                <p className="mt-1.5 text-xs text-gray-500">
                  Precio promocional: <span className="font-semibold text-red-500">${promoPrice.toFixed(2)}</span>
                </p>
              )}
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">Cancelar</button>
          <button onClick={onSave} disabled={!form.name || !form.price || (form.is_promoted && promoPrice === null)}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50">
            {editingProduct ? "Guardar cambios" : "Crear producto"}
          </button>
        </div>
      </div>
    </div>
  )
}
