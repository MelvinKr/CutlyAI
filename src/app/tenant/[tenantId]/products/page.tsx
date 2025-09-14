import { ensureDemoSeed } from "@/lib/demo-seed"
import TenantProductsTable from "@/components/products/TenantProductsTable"
import { searchProductsAction, updateProductAction, deleteProductAction } from "./actions"

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
  const page = Number(searchParams?.page ?? 1) || 1
  const pageSize = Math.min(200, Number(searchParams?.pageSize ?? 20) || 20)
  const q = typeof searchParams?.q === 'string' ? searchParams.q : undefined
  const cat = typeof searchParams?.cat === 'string' ? searchParams.cat : undefined
  const under = String(searchParams?.under || '') === 'true'
  const exp30 = String(searchParams?.exp30 || '') === 'true'

  const { rows, total } = await searchProductsAction(tenantId, { q, cat, under, exp30, page, pageSize })

  async function updateRow(formData: FormData) {
    'use server'
    const id = String(formData.get('id') || '')
    return await updateProductAction(tenantId, id, formData)
  }

  async function deleteRow(formData: FormData) {
    'use server'
    const id = String(formData.get('id') || '')
    return await deleteProductAction(tenantId, id)
  }

  return (
    <div className="p-6 space-y-4">
      <form className="flex flex-wrap gap-3 items-end" action={`/tenant/${tenantId}/products`}>
        <div>
          <label className="block text-sm">Rechercher</label>
          <input type="text" name="q" defaultValue={q ?? ''} placeholder="SKU, nom, marque, catégorie" className="border rounded p-2 w-64" />
        </div>
        <div>
          <label className="block text-sm">Catégorie</label>
          <input type="text" name="cat" defaultValue={cat ?? ''} placeholder="ex: shampoings" className="border rounded p-2 w-48" />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="under" value="true" defaultChecked={under} /> Sous seuil</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="exp30" value="true" defaultChecked={exp30} /> Expirant ≤ 30j</label>
        <input type="hidden" name="page" value="1" />
        <input type="hidden" name="pageSize" value={String(pageSize)} />
        <button className="bg-gray-900 text-white rounded px-3 py-2">Filtrer</button>
      </form>
      <TenantProductsTable rows={rows as any} total={total} page={page} pageSize={pageSize} updateAction={updateRow} deleteAction={deleteRow} />
    </div>
  )
}
