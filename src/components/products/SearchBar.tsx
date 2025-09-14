import Link from "next/link"

type Props = {
  initial: {
    q: string
    category: string
    activeOnly: boolean
    underThreshold: boolean
    expiringSoon: boolean
    page: number
    pageSize: number
  }
}

export default function SearchBar({ initial }: Props) {
  return (
    <form className="flex flex-wrap gap-3 items-end" action="/products" method="get">
      <div>
        <label className="block text-sm">Recherche</label>
        <input name="q" defaultValue={initial.q} className="border rounded p-2 w-64" placeholder="SKU, nom, marque" />
      </div>
      <div>
        <label className="block text-sm">Catégorie</label>
        <input name="category" defaultValue={initial.category} className="border rounded p-2 w-48" placeholder="ex: shampoings" />
      </div>
      <div className="flex items-center gap-2">
        <input id="activeOnly" type="checkbox" name="activeOnly" value="true" defaultChecked={initial.activeOnly} />
        <label htmlFor="activeOnly" className="text-sm">Actifs uniquement</label>
      </div>
      <div className="flex items-center gap-2">
        <input id="underThreshold" type="checkbox" name="underThreshold" value="true" defaultChecked={initial.underThreshold} />
        <label htmlFor="underThreshold" className="text-sm">Sous seuil</label>
      </div>
      <div className="flex items-center gap-2">
        <input id="expiringSoon" type="checkbox" name="expiringSoon" value="true" defaultChecked={initial.expiringSoon} />
        <label htmlFor="expiringSoon" className="text-sm">Lots ≤ 30j</label>
      </div>
      <input type="hidden" name="page" value={String(initial.page)} />
      <input type="hidden" name="pageSize" value={String(initial.pageSize)} />
      <button className="bg-gray-900 text-white rounded px-3 py-2">Filtrer</button>
      <Link href="/products" className="text-sm text-blue-600 hover:underline">Réinitialiser</Link>
    </form>
  )
}

