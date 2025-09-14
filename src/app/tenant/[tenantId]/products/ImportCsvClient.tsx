"use client"

import { useState } from "react"
import Papa from "papaparse"

type Row = Record<string, string>

export default function ImportCsvClient({ tenantId, importAction }: { tenantId: string, importAction: (fd: FormData) => Promise<any> }) {
  const [rows, setRows] = useState<Row[]>([])
  const [preview, setPreview] = useState<Row[]>([])
  const [error, setError] = useState<string | null>(null)

  const onFile = (file: File) => {
    setError(null)
    Papa.parse<Row>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        setRows(res.data)
        setPreview(res.data.slice(0, 10))
      },
      error: (err) => setError(err.message),
    })
  }

  const onValidate = async () => {
    const fd = new FormData()
    fd.append("tenantId", tenantId)
    fd.append("rows", JSON.stringify(rows))
    await importAction(fd)
  }

  return (
    <div className="border rounded p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="font-medium">Importer CSV</div>
          <div className="text-xs text-gray-600">Colonnes: sku,name,brand,category,unit,unit_size,retail_price,cost_price,min_stock_threshold</div>
        </div>
        <input type="file" accept=".csv" onChange={(e) => e.target.files && onFile(e.target.files[0])} />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      {preview.length > 0 && (
        <div className="text-sm">
          <div className="font-medium mb-1">Aperçu (10 premières lignes)</div>
          <pre className="bg-gray-50 p-2 rounded overflow-auto max-h-64">{JSON.stringify(preview, null, 2)}</pre>
          <button onClick={onValidate} className="mt-2 bg-emerald-600 text-white rounded px-4 py-2">Valider</button>
        </div>
      )}
    </div>
  )
}

