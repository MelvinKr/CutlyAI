"use client"

import { useState, useTransition } from "react"
import ProductForm from "./ProductForm"
import DeleteProductDialog from "./DeleteProductDialog"

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
  updated_at?: string
  stock_total?: number
  expiring_count?: number
}

export default function TenantProductsTable({
  rows,
  total,
  page,
  pageSize,
  updateAction,
  deleteAction,
}: {
  rows: Row[]
  total: number
  page: number
  pageSize: number
  updateAction: (formData: FormData) => Promise<any>
  deleteAction: (formData: FormData) => Promise<any>
}) {
  const [editing, setEditing] = useState<string | null>(null)
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div className="space-y-3">
      <div className="overflow-auto border rounded">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-3 py-2">SKU</th>
              <th className="text-left px-3 py-2">Nom</th>
              <th className="text-left px-3 py-2">Marque</th>
              <th className="text-left px-3 py-2">Catégorie</th>
              <th className="text-left px-3 py-2">Prix TTC</th>
              <th className="text-left px-3 py-2">Stock total</th>
              <th className="text-left px-3 py-2">Statut</th>
              <th className="text-left px-3 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => {
              const under = (p.stock_total ?? 0) <= (p.min_stock_threshold ?? 0) && (p.min_stock_threshold ?? 0) > 0
              return (
                <tr key={p.id} className="align-top odd:bg-white even:bg-gray-50">
                  <td className="px-3 py-2 font-mono">{p.sku}</td>
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2">{p.brand ?? ''}</td>
                  <td className="px-3 py-2">{p.category ?? ''}</td>
                  <td className="px-3 py-2">{p.retail_price ?? 0}€</td>
                  <td className="px-3 py-2">
                    <div className="font-medium">{p.stock_total ?? 0}</div>
                    {under && <span className="inline-block text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">Sous seuil</span>}
                    {(p.expiring_count ?? 0) > 0 && <span className="inline-block text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded ml-2">{p.expiring_count} lot(s) ≤30j</span>}
                  </td>
                  <td className="px-3 py-2">{p.is_active ? 'Actif' : 'Archivé'}</td>
                  <td className="px-3 py-2 space-x-3">
                    <button className="text-blue-600 hover:underline" onClick={() => setEditing(p.id)}>Modifier</button>
                    <DeleteProductDialog id={p.id} onDelete={deleteAction} />
                    {editing === p.id && (
                      <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-6 overflow-auto">
                        <div className="bg-white text-gray-900 rounded w-full max-w-3xl">
                          <div className="flex items-center justify-between border-b px-4 py-3">
                            <div className="font-medium">Modifier le produit</div>
                            <button onClick={() => setEditing(null)} className="text-sm">Fermer</button>
                          </div>
                          <div className="p-4">
                            <ProductForm
                              mode="edit"
                              initial={p as any}
                              onSubmit={async (fd) => { fd.set('id', p.id); await updateAction(fd); setEditing(null) }}
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 && (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-gray-500">Aucun produit</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between text-sm text-gray-700">
        <div>{total > 0 ? `${from}–${to} sur ${total}` : '0 résultat'}</div>
        <PaginationControl page={page} pageSize={pageSize} />
      </div>
    </div>
  )
}

function PaginationControl({ page, pageSize }: { page: number; pageSize: number }) {
  const [isPending, startTransition] = useTransition()
  const setPage = (p: number) => {
    startTransition(() => {
      const u = new URL(window.location.href)
      u.searchParams.set('page', String(p))
      u.searchParams.set('pageSize', String(pageSize))
      window.location.href = u.toString()
    })
  }
  return (
    <div className="flex gap-2">
      {page > 1 && <button disabled={isPending} onClick={() => setPage(page - 1)} className="px-3 py-1 border rounded">Précédent</button>}
      <button disabled={isPending} onClick={() => setPage(page + 1)} className="px-3 py-1 border rounded">Suivant</button>
    </div>
  )
}

