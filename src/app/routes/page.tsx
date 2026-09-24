import { Suspense } from "react";
import { ClientOnly } from "@/components/ui/client-only";
import { StudyRoutes } from "@/components/routes/study-routes";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Rutas de estudio",
  description: "Tu plan de repertorio: las piezas en orden, la rutina diaria y los objetivos, con cada partitura enlazada a tu biblioteca.",
  path: "/routes",
  noindex: true,
});

/**
 * One page for the list and the open route (`?route=<id>`), like the
 * library does with `?score=`: a single precached page works offline for
 * every route, and the browser's back button returns to the list.
 */
export default function RoutesPage() {
  return (
    <ClientOnly>
      {/* useSearchParams needs a Suspense boundary around it. */}
      <Suspense>
        <StudyRoutes />
      </Suspense>
    </ClientOnly>
  );
}
