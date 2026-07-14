"use client"

export default function DeleteDialog({ product, onConfirm, onClose }) {
  if (!product) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-gray-900">Eliminar producto</h3>
        <p className="mt-2 text-sm text-gray-500">
          ¿Estás seguro de eliminar <strong>{product.name}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">Cancelar</button>
          <button onClick={() => onConfirm(product.id)}
            className="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600">Eliminar</button>
        </div>
      </div>
    </div>
  )
}
