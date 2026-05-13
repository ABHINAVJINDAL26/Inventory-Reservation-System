import { CatalogView } from "@/components/catalog-view";
import { getCatalogPayload } from "@/lib/inventory";

export const dynamic = "force-dynamic";

export default async function Home() {
  const payload = await getCatalogPayload();

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 px-3 py-6 sm:px-4 md:px-8 lg:py-10">
      <CatalogView {...payload} />
    </main>
  );
}
