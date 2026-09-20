import { Suspense } from "react";
import { HomeownersScreen } from "./homeowners-screen";

export const metadata = { title: "Homeowners" };

export default function BoardHomeowners() {
  // The screen reads `?remind=1` from the URL, which is what the Suspense is
  // for: the rest of the page prerenders and the composer opens on the client.
  return (
    <Suspense fallback={null}>
      <HomeownersScreen />
    </Suspense>
  );
}
