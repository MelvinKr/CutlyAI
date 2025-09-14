"use client"

import { useState, useTransition } from "react"

export default function DeleteProductDialog({ id, onDelete }: { id: string; onDelete: (formData: FormData) => Promise<any> }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  return (
    <>
      <button onClick={() => setOpen(true)} className="text-red-600 hover:underline">Supprimer</button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white text-gray-900 rounded p-4 w-[320px]">
            <div className="font-medium mb-2">Confirmer la suppression</div>
            <div className="text-sm text-gray-600 mb-4">Cette action est définitive.</div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="px-3 py-1 border rounded">Annuler</button>
              <form action={(fd) => startTransition(async () => { fd.set('id', id); await onDelete(fd); setOpen(false) })}>
                <input type="hidden" name="id" value={id} />
                <button disabled={isPending} className="px-3 py-1 rounded bg-red-600 text-white">Supprimer</button>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

