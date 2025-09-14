import Link from "next/link"

type Row = {
  id: string
  sku: string
  name: string
  brand: string | null
  category: string | null
  unit: string | null
  unit_size: number | null
  retail_price: number | null
  cost_price: number | null
  min_stock_threshold: number | null
  is_active: boolean
  stock_total?: number
  expiring_count?: number
}

export default function ProductsTable({ rows, total, page, pageSize }: { rows: Row[]; total: number; page: number; pageSize: number }) {
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  const prevUrl = `?${new URLSearchParams({ page: String(Math.max(1, page - 1)), pageSize: String(pageSize) }).toString()}`
  const nextUrl = `?${new URLSearchParams({ page: String(page + 1), pageSize: String(pageSize) }).toString()}`
  return (
    <div className="space-y-3">
      <div className="overflow-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">SKU</th>
              <th className="text-left px-3 py-2">Nom</th>
              <th className="text-left px-3 py-2">Catégorie</th>
              <th className="text-left px-3 py-2">Stock total</th>
              <th className="text-left px-3 py-2">Prix</th>
              <th className="text-left px-3 py-2">Statut</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const under = (p.stock_total ?? 0) < (p.min_stock_threshold ?? 0)
              return (
                <tr key={p.id} className="odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-2 font-mono">{p.sku}</td>
                  <td className="px-3 py-2">
                    <div>{p.name}</div>
                    <div className="text-xs text-gray-500">{p.brand ?? ''}</div>
                  </td>
                  <td className="px-3 py-2">
                    <span className="inline-block text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">{p.category ?? '-'}</span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.stock_total ?? 0}</div>
                    {under && <span className="inline-block text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Sous seuil</span>}
                    {(p.expiring_count ?? 0) > 0 && <span className="inline-block text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded ml-2">{p.expiring_count} lot(s) à exp</span>}
                  </td>
                  <td className="px-3 py-2">{p.retail_price ?? 0}€</td>
                  <td className="px-3 py-2">{p.is_active ? 'Actif' : 'Archivé'}</td>
                  <td className="px-3 py-2">
                    <Link href={`/products/${p.id}`} className="text-blue-600 hover:underline">Modifier</Link>
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-500">Aucun résultat</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-700">
        <div>{total > 0 ? `${from}–${to} sur ${total}` : '0 résultat'}</div>
        <div className="flex gap-2">
          {page > 1 && <a className="px-3 py-1 border rounded" href={prevUrl}>Précédent</a>}
          {to < total && <a className="px-3 py-1 border rounded" href={nextUrl}>Suivant</a>}
        </div>
      </div>
    </div>
  )
}

