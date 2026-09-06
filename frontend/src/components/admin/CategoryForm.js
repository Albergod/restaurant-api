"use client"

export default function CategoryForm({ catForm, onChange, categories, categoryDialog, onSave, onClose, onDelete }) {
  if (!categoryDialog) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="text-lg font-bold text-gray-900">Nueva categoría</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Nombre</label>
            <input value={catForm.name} onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Ej: Bebidas"
              autoFocus
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-100" />
          </div>
        </div>

        {categories && categories.length > 0 && (
          <div className="mt-6 border-t border-gray-100 pt-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Existentes ({categories.length})
            </p>
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {categories.map((cat) => (
                <li key={cat.id} className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                  <span className="text-sm font-medium text-gray-700">{cat.name}</span>
                  <button
                    type="button"
                    onClick={() => onDelete(cat)}
                    title={`Eliminar ${cat.name}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                  >
                    <span className="text-lg leading-none">×</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">Cerrar</button>
          <button onClick={onSave} disabled={!catForm.name}
            className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50">Guardar</button>
        </div>
      </div>
    </div>
  )
}
