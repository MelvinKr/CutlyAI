import ProductsClient from "./ProductsClient"
import { createSupabaseServer } from "@/lib/supabase-server"
import { archiveProduct, createProduct, updateProduct, importProductsCsv } from "./actions"
import ImportCsvClient from "./ImportCsvClient"
import { ensureDemoSeed } from "@/lib/demo-seed"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY

export default async function ProductsPage({ params, searchParams }: { params: { tenantId: string }, searchParams: Record<string, string | string[] | undefined> }) {
  const tenantId = params.tenantId
  if (!supabaseUrl || !supabaseAnon) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">Configuration requise</h1>
        <p className="text-gray-700">Renseignez vos variables d'environnement Supabase dans <code className="px-1 py-0.5 rounded bg-gray-100">.env.local</code> puis relancez le serveur.</p>
        <pre className="p-3 bg-gray-100 rounded text-sm">
{`NEXT_PUBLIC_SUPABASE_URL=...\nNEXT_PUBLIC_SUPABASE_ANON_KEY=...\nSUPABASE_URL=...\nSUPABASE_ANON_KEY=...`}
        </pre>
        <p className="text-gray-600">Copiez l'exemple: <code className="px-1 py-0.5 rounded bg-gray-100">cutly/.env.local.example</code></p>
      </div>
    )
  }
  await ensureDemoSeed(tenantId)
  const supabase = await createSupabaseServer()
  const page = Number(searchParams?.page ?? 1) || 1
  const pageSize = Math.min(200, Number(searchParams?.pageSize ?? 50) || 50)
  const q = typeof searchParams?.q === 'string' ? searchParams.q : undefined

  let query = supabase
    .from("products")
    .select("id, tenant_id, name, sku, brand, category, retail_price, is_active, notes, min_stock_threshold", { count: 'exact' })
    .eq("tenant_id", tenantId)
  if (q && q.trim()) {
    const like = `%${q.trim()}%`
    query = query.or(`sku.ilike.${like},name.ilike.${like},brand.ilike.${like}`)
  }
  query = query.order("name", { ascending: true })
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  const { data: products, count } = await query.range(from, to)

  const ids = (products || []).map(p => p.id)
  let totals: Record<string, number> = {}
  let expiring: Record<string, number> = {}
  if (ids.length) {
    const { data: batches } = await supabase
      .from("product_batches")
      .select("product_id, qty_on_hand, exp_date")
      .eq("tenant_id", tenantId)
      .in("product_id", ids)
    const in30 = Date.now() + 30 * 24 * 3600 * 1000
    for (const b of batches || []) {
      totals[b.product_id] = (totals[b.product_id] || 0) + (b.qty_on_hand ?? 0)
      if (b.exp_date && new Date(b.exp_date).getTime() <= in30) {
        expiring[b.product_id] = (expiring[b.product_id] || 0) + 1
      }
    }
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <ImportCsvClient tenantId={tenantId} importAction={importProductsCsv} />
      </div>
      <form className="mb-3 flex gap-2 items-center" action={`/tenant/${tenantId}/products`}>
        <input type="text" name="q" defaultValue={q ?? ''} placeholder="Recherche sku, nom, marque" className="border rounded p-2 w-64" />
        <input type="hidden" name="pageSize" value={String(pageSize)} />
        <button className="bg-gray-800 text-white rounded px-3 py-2">Rechercher</button>
      </form>
      <ProductsClient
        tenantId={tenantId}
        initialProducts={(products || []).map(p => ({
          ...p,
          stock_total: totals[p.id] || 0,
          expiring_count: expiring[p.id] || 0,
        }))}
        createAction={createProduct}
        updateAction={updateProduct}
        archiveAction={archiveProduct}
      />
      <div className="mt-4 flex items-center justify-between text-sm text-gray-700">
        <div>
          {count !== null && count !== undefined && (
            (() => { const start = from + 1; const end = Math.min(to + 1, count!); return (<span>{start}–{end} sur {count}</span>) })()
          )}
        </div>
        <div className="flex gap-2">
          {page > 1 && <a className="px-3 py-1 border rounded" href={`?${new URLSearchParams({ q: q ?? '', page: String(page - 1), pageSize: String(pageSize) }).toString()}`}>Précédent</a>}
          {count && to + 1 < count && <a className="px-3 py-1 border rounded" href={`?${new URLSearchParams({ q: q ?? '', page: String(page + 1), pageSize: String(pageSize) }).toString()}`}>Suivant</a>}
        </div>
      </div>
    </div>
  )
}
