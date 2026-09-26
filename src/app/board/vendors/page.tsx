import { Suspense } from "react";
import { VendorsScreen } from "./vendors-screen";

export const metadata = { title: "Vendors" };

export default function BoardVendors() {
  // The screen reads `?record=1` from the URL (search's "Record a payment"
  // shortcut lands here with the form open), which is what the Suspense is
  // for: the rest of the page prerenders and the form opens on the client.
  return (
    <Suspense fallback={null}>
      <VendorsScreen />
    </Suspense>
  );
}
