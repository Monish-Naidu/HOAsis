import { Suspense } from "react";
import { OverviewScreen } from "./overview-screen";

export const metadata = { title: "Finances" };

export default function BoardMoney() {
  // The charts' period is in the URL (`?period=`), which is what the Suspense
  // is for: the rest of the page prerenders and the period resolves on the client.
  return (
    <Suspense fallback={null}>
      <OverviewScreen />
    </Suspense>
  );
}
