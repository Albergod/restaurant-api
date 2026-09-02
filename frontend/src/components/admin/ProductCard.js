"use client"

import { Trash2, Pencil, Eye, EyeOff, Star, Percent, Image } from "lucide-react"
import { getImageUrl } from "@/lib/api"

export default function ProductCard({ product, onToggle, onEdit, onDelete }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm transition-all hover:shadow-md overflow-hidden flex flex-col">
      <div className="aspect-square bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center overflow-hidden">
        {product.image_url ? (
          <img src={getImageUrl(product.image_url)} alt={product.name} className="h-full w-full object-cover" />
        ) : (
          <Image className="h-10 w-10 text-gray-300" />
        )}
      </div>
      <div className="p-3 flex flex-col flex-1 gap-1.5">
        <div className="flex items-start justify-between gap-1">
          <p className="text-sm font-bold text-gray-900 leading-tight truncate flex-1">{product.name}</p>
          {product.is_available === false && (
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[9px] font-medium text-gray-500">Oculto</span>
          )}
        </div>
        <p className="text-[10px] font-medium text-gray-400 truncate">{product.category_name || "Sin categoría"}</p>
        <p className="text-base font-black text-gray-900">${Number(product.price).toFixed(2)}</p>
        <div className="mt-auto flex items-center justify-between pt-1">
          <div className="flex gap-1">
            <button onClick={() => onToggle(product.id, "is_available")}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${product.is_available ? "bg-green-100 text-green-600 hover:bg-green-200" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
              title={product.is_available ? "Visible" : "Oculto"}>
              {product.is_available ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            </button>
            <button onClick={() => onToggle(product.id, "is_featured")}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${product.is_featured ? "bg-orange-100 text-orange-600 hover:bg-orange-200" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
              title={product.is_featured ? "Destacado" : "Destacar"}>
              <Star className={`h-3.5 w-3.5 ${product.is_featured ? "fill-orange-500" : ""}`} />
            </button>
            <button onClick={() => onToggle(product.id, "is_promoted")}
              className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs transition-colors ${product.is_promoted ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-gray-100 text-gray-400 hover:bg-gray-200"}`}
              title={product.is_promoted ? "En promo" : "En promoción"}>
              <Percent className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex gap-1">
            <button onClick={() => onEdit(product)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-gray-200 text-gray-400 transition-colors hover:border-gray-300 hover:text-gray-600">
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button onClick={() => onDelete(product)}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 text-red-400 transition-colors hover:border-red-300 hover:text-red-600 hover:bg-red-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
