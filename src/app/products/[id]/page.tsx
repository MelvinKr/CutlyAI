import ProductForm from "@/components/products/ProductForm"
import { createSupabaseServer } from "@/lib/supabase-server"
import { updateProduct, deleteProduct } from "../actions"

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  const supabase = await createSupabaseServer()
  const { data: userRes } = await supabase.auth.getUser()
  if (!userRes?.user) {
    return <div className="p-6">Veuillez vous connecter.</div>
  }

  const { data: product } = await supabase
    .from('products')
    .select('id, sku, name, brand, category, unit, unit_size, retail_price, cost_price, min_stock_threshold, is_active')
    .eq('id', params.id)
    .maybeSingle()

  if (!product) return <div className="p-6">Produit introuvable.</div>

  async function save(formData: FormData) {
    'use server'
    return await updateProduct(params.id, formData)
  }

  async function destroy() {
    'use server'
    return await deleteProduct(params.id)
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold mb-4">Modifier le produit</h1>
      <ProductForm mode="edit" initial={product as any} onSubmit={save} onDelete={destroy} />
    </div>
  )
}

