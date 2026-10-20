import { UltronProvider } from "@/components/UltronContext";
import { BiomechanicalHud } from "@/components/BiomechanicalHud";
import { BiomechanicalHero } from "@/components/BiomechanicalHero";
import { BiomechanicalGameGrid } from "@/components/BiomechanicalGameGrid";
import { AdminTerminal } from "@/components/AdminTerminal";

export const dynamic = "force-dynamic";

/**
 * Biomechanical Ultron homepage — obsidian hero canvas, category
 * game deck and the slide-down admin terminal, all wrapped in the
 * fixed HUD shell. The playable arcade stays untouched at
 * /index.html (its canvas loops, physics and input handlers are
 * never mounted or modified here).
 */
export default function HomePage() {
  return (
    <UltronProvider>
      <BiomechanicalHud />
      <BiomechanicalHero />
      <BiomechanicalGameGrid />
      <AdminTerminal />
    </UltronProvider>
  );
}
