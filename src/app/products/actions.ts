"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { createSupabaseServer } from "@/lib/supabase-server"

// Zod schema (adapter for existing table). If your table misses some columns,
// they will be ignored on insert/update.
export const productSchema = z.object({
  sku: z.string().trim().min(2, "SKU trop court").transform((s) => s.toUpperCase()),
  name: z.string().trim().min(2, "Nom trop court"),
  brand: z.string().trim().optional().nullable().default(null),
  category: z.string().trim().min(2, "Catégorie requise"),
  unit: z.string().trim().default("unit"),
  unit_size: z.coerce.number().optional().nullable(),
  retail_price: z.coerce.number().min(0).default(0),
  cost_price: z.coerce.number().min(0).default(0),
  min_stock_thresh: z.coerce.number().int().min(0).default(0),
  tax_rate: z.coerce.number().min(0).max(0.3).default(0),
  is_active: z.coerce.boolean().default(true),
  expires_in_days: z.coerce.number().int().min(0).nullable().optional(),
})

type ProductInput = z.infer<typeof productSchema>

async function getClient() {
  return await createSupabaseServer()
}

function mapToDbFields(v: ProductInput) {
  // Map requested schema -> existing DB columns (min_stock_threshold instead of min_stock_thresh)
  // Extra fields (tax_rate, expires_in_days) are included if DB supports them.
  const base: Record<string, any> = {
    sku: v.sku,
    name: v.name,
    brand: v.brand ?? null,
    category: v.category,
    unit: v.unit || "unit",
    unit_size: v.unit_size ?? null,
    retail_price: v.retail_price ?? 0,
    cost_price: v.cost_price ?? 0,
    min_stock_threshold: v.min_stock_thresh ?? 0,
    is_active: v.is_active ?? true,
  }
  base["tax_rate"] = v.tax_rate ?? 0
  base["expires_in_days"] = v.expires_in_days ?? null
  return base
}

export async function createProduct(formData: FormData) {
  const supabase = await getClient()
  const parsed = productSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") }
  }
  const v = parsed.data

  // Enforce SKU uniqueness at app-level (DB unique recommended too)
  const { data: exists, error: existErr } = await supabase
    .from("products")
    .select("id")
    .eq("sku", v.sku)
    .limit(1)
  if (existErr) return { error: existErr.message }
  if (exists && exists.length > 0) return { error: "SKU déjà utilisé" }

  const { error } = await supabase.from("products").insert(mapToDbFields(v))
  if (error) return { error: error.message }
  revalidatePath("/products")
  return { ok: true }
}

export async function updateProduct(id: string, formData: FormData) {
  const supabase = await getClient()
  const parsed = productSchema.safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join(", ") }
  }
  const v = parsed.data

  // Unique per SKU excluding current id
  const { data: exists, error: existErr } = await supabase
    .from("products")
    .select("id")
    .eq("sku", v.sku)
    .neq("id", id)
    .limit(1)
  if (existErr) return { error: existErr.message }
  if (exists && exists.length > 0) return { error: "SKU déjà utilisé" }

  const { error } = await supabase
    .from("products")
    .update(mapToDbFields(v))
    .eq("id", id)
  if (error) return { error: error.message }
  revalidatePath(`/products/${id}`)
  revalidatePath("/products")
  return { ok: true }
}

export async function deleteProduct(id: string) {
  const supabase = await getClient()
  const { error } = await supabase.from("products").delete().eq("id", id)
  if (error) return { error: error.message }
  revalidatePath("/products")
  return { ok: true }
}

export type CsvRow = {
  sku: string
  name: string
  brand?: string
  category?: string
  unit?: string
  unit_size?: number
  retail_price?: number
  cost_price?: number
  min_stock_thresh?: number
  tax_rate?: number
}

export async function bulkUpsertProductsFromCsv(rows: CsvRow[]) {
  const supabase = await getClient()
  const errors: { index: number; message: string }[] = []
  let created = 0
  let updated = 0

  // Validate each row with schema
  const validated: ProductInput[] = []
  rows.forEach((r, idx) => {
    const parsed = productSchema.safeParse(r)
    if (!parsed.success) {
      errors.push({ index: idx, message: parsed.error.issues.map((i) => i.message).join(", ") })
    } else {
      validated.push(parsed.data)
    }
  })

  if (validated.length === 0) return { created, updated, errors }

  // Determine existing SKUs
  const skus = Array.from(new Set(validated.map((v) => v.sku)))
  const { data: exist } = await supabase
    .from("products")
    .select("sku")
    .in("sku", skus)
  const existing = new Set((exist || []).map((x: any) => x.sku))
  const toInsert = validated.filter((v) => !existing.has(v.sku)).map(mapToDbFields)
  const toUpdate = validated.filter((v) => existing.has(v.sku)).map(mapToDbFields)

  // Insert in chunks of 50
  for (let i = 0; i < toInsert.length; i += 50) {
    const part = toInsert.slice(i, i + 50)
    const { error } = await supabase.from("products").insert(part)
    if (error) {
      // Attribute same error to the chunk (approx)
      for (let j = 0; j < part.length; j++) errors.push({ index: i + j, message: error.message })
    } else created += part.length
  }

  // Update one by one to avoid accidental overwrite
  for (const r of toUpdate) {
    const { error } = await supabase
      .from("products")
      .update(r)
      .eq("sku", r.sku)
    if (error) errors.push({ index: 0, message: error.message })
    else updated += 1
  }

  revalidatePath("/products")
  return { created, updated, errors }
}

export type SearchFilters = {
  q?: string
  category?: string
  activeOnly?: boolean
  underThreshold?: boolean
  expiringSoon?: boolean
  page?: number
  pageSize?: number
}

export async function searchProducts(filters: SearchFilters) {
  const supabase = await getClient()
  const page = Math.max(1, filters.page || 1)
  const pageSize = Math.min(100, Math.max(1, filters.pageSize || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let query = supabase
    .from("products")
    .select("id, sku, name, brand, category, unit, unit_size, retail_price, cost_price, min_stock_threshold, is_active, updated_at", { count: "exact" })

  if (filters.q && filters.q.trim()) {
    const like = `%${filters.q.trim()}%`
    // sku OR name OR brand
    query = query.or(`sku.ilike.${like},name.ilike.${like},brand.ilike.${like}`)
  }
  if (filters.category) query = query.eq("category", filters.category)
  if (filters.activeOnly) query = query.eq("is_active", true)
  query = query.order("name", { ascending: true }).order("updated_at", { ascending: false })

  const { data, count } = await query.range(from, to)

  // Compute stock_total and expiring_count for visible rows (avoid N+1):
  const ids = (data || []).map((p: any) => p.id)
  const totals: Record<string, number> = {}
  const expiring: Record<string, number> = {}
  if (ids.length) {
    const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
    const { data: batches } = await supabase
      .from("product_batches")
      .select("product_id, qty_on_hand, exp_date")
      .in("product_id", ids)
    for (const b of batches || []) {
      totals[b.product_id] = (totals[b.product_id] || 0) + (b.qty_on_hand || 0)
      if (b.exp_date && b.exp_date <= in30) expiring[b.product_id] = (expiring[b.product_id] || 0) + 1
    }
  }

  let rows = (data || []).map((p: any) => ({
    ...p,
    stock_total: totals[p.id] || 0,
    expiring_count: expiring[p.id] || 0,
  }))

  if (filters.underThreshold) rows = rows.filter((r) => (r.stock_total || 0) < (r.min_stock_threshold || 0))
  if (filters.expiringSoon) rows = rows.filter((r) => (r.expiring_count || 0) > 0)

  return { rows, total: count || 0, page, pageSize }
}

