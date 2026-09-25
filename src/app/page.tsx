import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The arcade shell is a fully static experience served from public/. */
export default function HomePage() {
  redirect("/index.html");
}
