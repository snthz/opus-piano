import { RhythmTapping } from "@/components/practice/rhythm-tapping";
import { ClientOnly } from "@/components/ui/client-only";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Ejercicio de ritmo con metrónomo",
  description:
    "Lee un ritmo escrito y márcalo con el pulso del metrónomo. El ejercicio mide si cada golpe cae donde debe y te dice dónde se te va el tiempo.",
  path: "/practice/rhythm",
  keywords: ["ejercicio de ritmo", "metrónomo online", "practicar ritmo musical", "lectura rítmica"],
});

export default function Page() {
  return (
    <ClientOnly>
      <RhythmTapping />
    </ClientOnly>
  );
}
