import Link from "next/link"
import TenantLinker from "@/components/TenantLinker"

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h1 className="text-3xl font-semibold">Bienvenue 👋</h1>
        <p className="text-gray-600">Gérez vos produits, rendez-vous et plus encore.</p>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="border rounded p-4">
          <h2 className="font-medium mb-2">Produits</h2>
          <p className="text-sm text-gray-600 mb-3">Créer, éditer, archiver et suivre en temps réel.</p>
          <div className="flex items-center gap-3">
            <Link href="/tenant/demo/products" className="text-blue-600 hover:underline">Voir exemple (tenant: demo)</Link>
          </div>
          <div className="mt-3">
            <TenantLinker />
          </div>
        </div>

        <div className="border rounded p-4">
          <h2 className="font-medium mb-2">Rendez-vous</h2>
          <p className="text-sm text-gray-600">Planification et rappels (à venir).</p>
        </div>

        <div className="border rounded p-4">
          <h2 className="font-medium mb-2">Clients</h2>
          <p className="text-sm text-gray-600">Fidélisation et historique (à venir).</p>
        </div>

        <div className="border rounded p-4">
          <h2 className="font-medium mb-2">Rapports</h2>
          <p className="text-sm text-gray-600">Ventes, stocks, performances (à venir).</p>
        </div>
      </section>
    </div>
  )
}

