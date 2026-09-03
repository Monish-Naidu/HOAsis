import { Suspense } from "react";
import { TransactionsScreen } from "./transactions-screen";

export const metadata = { title: "Transactions" };

export default function BoardTransactions() {
  // The screen reads `?status=` from the URL, which is what the Suspense is
  // for: the rest of the page prerenders and the filter resolves on the client.
  return (
    <Suspense fallback={null}>
      <TransactionsScreen />
    </Suspense>
  );
}
