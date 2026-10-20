import { UltronProvider } from "@/components/UltronContext";
import { BiomechanicalHud } from "@/components/BiomechanicalHud";
import { BiomechanicalHero } from "@/components/BiomechanicalHero";
import { AdminTerminal } from "@/components/AdminTerminal";

export const dynamic = "force-dynamic";

/**
 * Biomechanical Ultron homepage — obsidian hero canvas wrapped in the
 * fixed HUD shell with the slide-down admin terminal. The playable
 * arcade stays untouched at /index.html (its canvas loops, physics and
 * input handlers are never mounted or modified here).
 */
export default function HomePage() {
  return (
    <UltronProvider>
      <BiomechanicalHud />
      <BiomechanicalHero />
      <AdminTerminal />
    </UltronProvider>
  );
}
