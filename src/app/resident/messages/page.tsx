import { Suspense } from "react";
import { MessagesScreen } from "./messages-screen";

export const metadata = {
  title: "Messages",
  description: "Your conversations with the board.",
};

export default function ResidentMessages() {
  // The screen reads `?subject=` (a request page sends its owner here with
  // the subject filled in), which is what the Suspense is for.
  return (
    <Suspense fallback={null}>
      <MessagesScreen />
    </Suspense>
  );
}
