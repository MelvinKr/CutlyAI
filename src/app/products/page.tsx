import { createSupabaseServer } from "@/lib/supabase-server"
import { bulkUpsertProductsFromCsv, searchProducts } from "./actions"
import ProductsTable from "@/components/products/ProductsTable"
import SearchBar from "@/components/products/SearchBar"
import CsvImportDialog from "@/components/products/CsvImportDialog"

export const dynamic = 'force-dynamic'

export default async function ProductsPage({ searchParams }: { searchParams: Record<string, string | string[] | undefined> }) {
  // Ensure authenticated (RLS may require)
  const supabase = await createSupabaseServer()
  const { data: userRes } = await supabase.auth.getUser()
  const user = userRes?.user
  if (!user) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-xl font-semibold">Produits</h1>
        <p className="text-gray-600">Veuillez vous connecter pour accéder à cette page.</p>
      </div>
    )
  }

  const page = Number(searchParams?.page || 1) || 1
  const pageSize = Number(searchParams?.pageSize || 20) || 20
  const q = typeof searchParams?.q === 'string' ? searchParams.q : undefined
  const category = typeof searchParams?.category === 'string' ? searchParams.category : undefined
  const activeOnly = String(searchParams?.activeOnly || '') === 'true'
  const underThreshold = String(searchParams?.underThreshold || '') === 'true'
  const expiringSoon = String(searchParams?.expiringSoon || '') === 'true'

  const { rows, total } = await searchProducts({ q, category, activeOnly, underThreshold, expiringSoon, page, pageSize })

  async function importCsv(rows: any[]) {
    'use server'
    return await bulkUpsertProductsFromCsv(rows)
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <h1 className="text-2xl font-semibold">Produits</h1>
        <CsvImportDialog importAction={importCsv} />
      </div>
      <SearchBar initial={{ q: q ?? '', category: category ?? '', activeOnly, underThreshold, expiringSoon, page, pageSize }} />
      <ProductsTable rows={rows} total={total} page={page} pageSize={pageSize} />
    </div>
  )
}

