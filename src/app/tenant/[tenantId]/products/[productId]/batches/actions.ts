"use server"

import { revalidatePath } from "next/cache"
import { createSupabaseServer } from "@/lib/supabase-server"
import { withTelemetry } from "@/lib/telemetry"

export async function createBatchAndInMovement(formData: FormData) {
  const supabase = await createSupabaseServer()
  const tenantId = String(formData.get("tenantId") || "").trim()
  const productId = String(formData.get("productId") || "").trim()

  const batchCode = (formData.get("batch_code") as string) || null
  const expDate = (formData.get("exp_date") as string) || null
  const supplierId = (formData.get("supplier_id") as string) || null
  const unitCost = formData.get("unit_cost") ? Number(formData.get("unit_cost")) : null
  const qtyIn = Number(formData.get("qty_in") || 0)

  if (!tenantId || !productId) return { error: "Identifiants manquants" }
  if (!qtyIn || isNaN(qtyIn) || qtyIn <= 0) return { error: "Quantité (IN) requise" }

  return withTelemetry("createBatchAndInMovement", tenantId, async () => {
    // Find or create batch
    let batchId: string | null = (formData.get("batch_id") as string) || null

    if (!batchId) {
      // Try to find by code if provided
      if (batchCode) {
        const { data: existing, error: findErr } = await supabase
          .from("product_batches")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("product_id", productId)
          .eq("batch_code", batchCode)
          .limit(1)
          .maybeSingle()

        if (findErr) return { error: findErr.message }
        if (existing) batchId = existing.id
      }

      if (!batchId) {
        const { data: created, error: insErr } = await supabase
          .from("product_batches")
          .insert({
            tenant_id: tenantId,
            product_id: productId,
            batch_code: batchCode,
            exp_date: expDate,
            supplier_id: supplierId,
            cost_price: unitCost ?? 0,
            qty_on_hand: 0,
            received_at: new Date().toISOString(),
          })
          .select("id")
          .single()

        if (insErr) return { error: insErr.message }
        batchId = created.id
      }
    }

    // Update stock on batch: read current qty then write new qty
    // Read current qty
    const { data: batchRow, error: readErr } = await supabase
      .from("product_batches")
      .select("qty_on_hand")
      .eq("id", batchId!)
      .eq("tenant_id", tenantId)
      .single()
    if (readErr) return { error: readErr.message }
    const newQty = (batchRow?.qty_on_hand ?? 0) + qtyIn
    const { error: writeErr } = await supabase
      .from("product_batches")
      .update({ qty_on_hand: newQty })
      .eq("id", batchId!)
      .eq("tenant_id", tenantId)
    if (writeErr) return { error: writeErr.message }

    // Record movement
    const { error: movErr } = await supabase.from("stock_movements").insert({
      tenant_id: tenantId,
      product_id: productId,
      batch_id: batchId,
      type: "IN",
      qty: qtyIn,
      reason: "reception",
    })
    if (movErr) return { error: movErr.message }

    revalidatePath(`/tenant/${tenantId}/products/${productId}/batches`)
    return { ok: true }
  })
}

export async function adjustBatch(formData: FormData) {
  const supabase = await createSupabaseServer()
  const tenantId = String(formData.get("tenantId") || "").trim()
  const productId = String(formData.get("productId") || "").trim()
  const batchId = String(formData.get("batch_id") || "").trim()
  const delta = Number(formData.get("qty_delta") || 0)
  const reason = String(formData.get("reason") || "ajustement")
  if (!tenantId || !productId || !batchId) return { error: "Identifiants manquants" }
  if (!delta || isNaN(delta)) return { error: "Delta requis (peut être négatif)" }

  return withTelemetry("adjustBatch", tenantId, async () => {
    const { data: batchRow, error: readErr } = await supabase
      .from("product_batches")
      .select("qty_on_hand")
      .eq("id", batchId)
      .eq("tenant_id", tenantId)
      .single()
    if (readErr) return { error: readErr.message }
    const newQty = (batchRow?.qty_on_hand ?? 0) + delta
    if (newQty < 0) return { error: "Stock négatif interdit" }

    const { error: writeErr } = await supabase
      .from("product_batches")
      .update({ qty_on_hand: newQty })
      .eq("id", batchId)
      .eq("tenant_id", tenantId)
    if (writeErr) return { error: writeErr.message }

    const { error: movErr } = await supabase.from("stock_movements").insert({
      tenant_id: tenantId,
      product_id: productId,
      batch_id: batchId,
      type: "ADJUST",
      qty: delta,
      reason,
    })
    if (movErr) return { error: movErr.message }

    revalidatePath(`/tenant/${tenantId}/products/${productId}/batches`)
    return { ok: true }
  })
}
