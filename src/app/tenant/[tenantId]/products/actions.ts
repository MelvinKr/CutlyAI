"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseServer } from "@/lib/supabase-server"
import { withTelemetry } from "@/lib/telemetry"
import { z } from "zod"

type Category = "shampoings" | "colorations" | "soins" | "accessoires"

const getSupabase = async () => await createSupabaseServer()

export async function createProduct(formData: FormData) {
  const supabase = await getSupabase()
  const tenantId = String(formData.get("tenantId") || "").trim()
  const name = String(formData.get("name") || "").trim()
  const sku = String(formData.get("sku") || "").trim()
  const category = String(formData.get("category") || "").trim() as Category
  const retailPrice = Number(formData.get("retail_price") || 0)
  const notes = (formData.get("notes") as string) || null

  if (!tenantId) return { error: "tenantId manquant" }
  if (!name) return { error: "Nom obligatoire" }
  if (!sku) return { error: "SKU obligatoire" }

  // Enforce SKU unique per tenant (app-level guard)
  const { data: existing, error: existErr } = await supabase
    .from("products")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("sku", sku)
    .limit(1)

  if (existErr) return { error: existErr.message }
  if (existing && existing.length > 0)
    return { error: "SKU déjà utilisé pour ce tenant" }

  const { error } = await supabase.from("products").insert({
    tenant_id: tenantId,
    name,
    sku,
    category,
    retail_price: isNaN(retailPrice) ? 0 : retailPrice,
    is_active: true,
  })

  if (error) return { error: error.message }
  revalidatePath(`/tenant/${tenantId}/products`)
  return { ok: true }
}

export async function updateProduct(formData: FormData) {
  const supabase = await getSupabase()
  const tenantId = String(formData.get("tenantId") || "").trim()
  const id = String(formData.get("id") || "").trim()
  const name = String(formData.get("name") || "").trim()
  const sku = String(formData.get("sku") || "").trim()
  const category = String(formData.get("category") || "").trim() as Category
  const retailPrice = Number(formData.get("retail_price") || 0)
  const isActive = String(formData.get("is_active") || "true") === "true"
  const notes = (formData.get("notes") as string) || null

  if (!tenantId || !id) return { error: "Identifiants manquants" }
  if (!name) return { error: "Nom obligatoire" }
  if (!sku) return { error: "SKU obligatoire" }

  // Ensure SKU unique per tenant excluding current product
  const { data: existing, error: existErr } = await supabase
    .from("products")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("sku", sku)
    .neq("id", id)
    .limit(1)

  if (existErr) return { error: existErr.message }
  if (existing && existing.length > 0)
    return { error: "SKU déjà utilisé pour ce tenant" }

  const { error } = await supabase
    .from("products")
    .update({
      name,
      sku,
      category,
      retail_price: isNaN(retailPrice) ? 0 : retailPrice,
      is_active: isActive,
      notes,
    })
    .eq("id", id)
    .eq("tenant_id", tenantId)

  if (error) return { error: error.message }
  revalidatePath(`/tenant/${tenantId}/products`)
  return { ok: true }
}

export async function archiveProduct(formData: FormData) {
  const supabase = await getSupabase()
  const tenantId = String(formData.get("tenantId") || "").trim()
  const id = String(formData.get("id") || "").trim()
  if (!tenantId || !id) return { error: "Identifiants manquants" }

  const { error } = await supabase
    .from("products")
    .update({ is_active: false })
    .eq("id", id)
    .eq("tenant_id", tenantId)

  if (error) return { error: error.message }
  revalidatePath(`/tenant/${tenantId}/products`)
  return { ok: true }
}

export async function importProductsCsv(formData: FormData) {
  const supabase = await getSupabase()
  const tenantId = String(formData.get("tenantId") || "").trim()
  const rowsStr = String(formData.get("rows") || "[]")
  if (!tenantId) return { error: "tenantId manquant" }
  let rows: any[] = []
  try { rows = JSON.parse(rowsStr) } catch { return { error: "CSV invalide" } }

  return withTelemetry("importProductsCsv", tenantId, async () => {
    const schema = z.object({
      sku: z.string().trim().min(1, "SKU requis"),
      name: z.string().trim().min(1, "Nom requis"),
      brand: z.string().trim().optional().nullable(),
      category: z.string().trim().optional().nullable(),
      unit: z.string().trim().default("u"),
      unit_size: z.coerce.number().optional().nullable(),
      retail_price: z.coerce.number().default(0),
      cost_price: z.coerce.number().default(0),
      min_stock_threshold: z.coerce.number().default(0),
    })

    // Validate rows and collect errors per line
    const validRows: any[] = []
    const errors: { index: number; message: string }[] = []
    rows.forEach((r, idx) => {
      const parsed = schema.safeParse(r)
      if (!parsed.success) {
        errors.push({ index: idx, message: parsed.error.issues.map(i => i.message).join(', ') })
        return
      }
      const v = parsed.data
      validRows.push({
        tenant_id: tenantId,
        sku: v.sku,
        name: v.name,
        brand: v.brand ?? null,
        category: v.category ?? null,
        unit: v.unit || 'u',
        unit_size: v.unit_size ?? null,
        retail_price: v.retail_price ?? 0,
        cost_price: v.cost_price ?? 0,
        min_stock_threshold: v.min_stock_threshold ?? 0,
        is_active: true,
      })
    })

    if (validRows.length === 0) {
      return { created: 0, updated: 0, errors }
    }

    // Determine existing SKUs for this tenant
    const skus = Array.from(new Set(validRows.map(r => r.sku)))
    const { data: existing } = await supabase
      .from('products')
      .select('sku')
      .eq('tenant_id', tenantId)
      .in('sku', skus)
    const existingSet = new Set((existing || []).map(r => r.sku))
    const toInsert = validRows.filter(r => !existingSet.has(r.sku))
    const toUpdate = validRows.filter(r => existingSet.has(r.sku))

    const chunk = 50
    let created = 0
    let updated = 0
    // Inserts
    for (let i = 0; i < toInsert.length; i += chunk) {
      const part = toInsert.slice(i, i + chunk)
      const { error } = await supabase.from('products').insert(part)
      if (error) {
        part.forEach((_, idx) => errors.push({ index: idx, message: error.message }))
      } else {
        created += part.length
      }
    }
    // Updates (by sku)
    for (let i = 0; i < toUpdate.length; i += chunk) {
      const part = toUpdate.slice(i, i + chunk)
      for (const r of part) {
        const { error } = await supabase
          .from('products')
          .update({
            name: r.name,
            brand: r.brand,
            category: r.category,
            unit: r.unit,
            unit_size: r.unit_size,
            retail_price: r.retail_price,
            cost_price: r.cost_price,
            min_stock_threshold: r.min_stock_threshold,
            is_active: r.is_active,
          })
          .eq('tenant_id', tenantId)
          .eq('sku', r.sku)
        if (error) {
          errors.push({ index: 0, message: error.message })
        } else {
          updated += 1
        }
      }
    }

    revalidatePath(`/tenant/${tenantId}/products`)
    return { created, updated, errors }
  })
}

// SEARCH/LIST SUPPORT FOR TENANT ROUTE
type SearchParams = { q?: string; cat?: string; under?: boolean; exp30?: boolean; page?: number; pageSize?: number }

export async function searchProductsAction(tenant: string, params: SearchParams) {
  const supabase = await getSupabase()
  const page = Math.max(1, params.page || 1)
  const pageSize = Math.min(100, Math.max(1, params.pageSize || 20))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1

  let q = supabase
    .from('products')
    .select('id, tenant_id, sku, name, brand, category, unit, unit_size, retail_price, cost_price, min_stock_threshold, is_active, updated_at', { count: 'exact' })
    .eq('tenant_id', tenant)

  if (params.q && params.q.trim()) {
    const like = `%${params.q.trim()}%`
    q = q.or(`sku.ilike.${like},name.ilike.${like},brand.ilike.${like},category.ilike.${like}`)
  }
  if (params.cat && params.cat.trim()) q = q.eq('category', params.cat.trim())

  q = q.order('updated_at', { ascending: false })
  const { data, count } = await q.range(from, to)

  // Compute stock_total and expiring within 30 days (from product_batches) then apply in-memory filters
  const ids = (data || []).map((p: any) => p.id)
  const totals: Record<string, number> = {}
  const expiring: Record<string, number> = {}
  if (ids.length) {
    const in30 = new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
    const { data: batches } = await supabase
      .from('product_batches')
      .select('product_id, qty_on_hand, exp_date')
      .in('product_id', ids)
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

  if (params.under) rows = rows.filter(r => (r.min_stock_threshold || 0) > 0 && (r.stock_total || 0) <= (r.min_stock_threshold || 0))
  if (params.exp30) rows = rows.filter(r => (r.expiring_count || 0) > 0)

  return { rows, total: count || 0, page, pageSize }
}

export async function updateProductAction(tenant: string, id: string, formData: FormData) {
  const supabase = await getSupabase()
  const parsed = z.object({
    sku: z.string().trim().min(2),
    name: z.string().trim().min(2),
    brand: z.string().trim().optional().nullable(),
    category: z.string().trim().min(2),
    unit: z.string().trim().optional(),
    unit_size: z.coerce.number().optional().nullable(),
    retail_price: z.coerce.number().min(0).optional(),
    cost_price: z.coerce.number().min(0).optional(),
    min_stock_thresh: z.coerce.number().int().min(0).optional(),
    tax_rate: z.coerce.number().min(0).max(0.3).optional(),
    is_active: z.coerce.boolean().optional(),
    expires_in_days: z.coerce.number().int().min(0).nullable().optional(),
  }).safeParse(Object.fromEntries(formData.entries()))
  if (!parsed.success) return { ok: false, message: parsed.error.issues.map(i => i.message).join(', ') }
  const v = parsed.data
  const payload: any = {
    sku: v.sku.trim().toUpperCase(),
    name: v.name.trim(),
    brand: v.brand ?? null,
    category: v.category.trim(),
    unit: v.unit || 'unit',
    unit_size: v.unit_size ?? 1,
    retail_price: v.retail_price ?? 0,
    cost_price: v.cost_price ?? 0,
    min_stock_threshold: v.min_stock_thresh ?? 0,
    tax_rate: v.tax_rate ?? 0,
    is_active: v.is_active ?? true,
    expires_in_days: v.expires_in_days ?? null,
  }
  const { data: exists, error: exErr } = await supabase
    .from('products').select('id').eq('tenant_id', tenant).eq('sku', payload.sku).neq('id', id).limit(1)
  if (exErr) return { ok: false, message: exErr.message }
  if (exists && exists.length) return { ok: false, message: 'SKU déjà utilisé pour ce tenant' }

  const { error } = await supabase
    .from('products')
    .update(payload)
    .eq('tenant_id', tenant)
    .eq('id', id)
  if (error) return { ok: false, message: error.message }
  revalidatePath(`/tenant/${tenant}/products`)
  return { ok: true }
}

export async function deleteProductAction(tenant: string, id: string) {
  const supabase = await getSupabase()
  const { error } = await supabase.from('products').delete().eq('tenant_id', tenant).eq('id', id)
  if (error) return { ok: false, message: error.message }
  revalidatePath(`/tenant/${tenant}/products`)
  return { ok: true }
}
