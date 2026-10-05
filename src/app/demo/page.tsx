import { DemoEntry } from "./demo-entry";

export const metadata = { title: "Demo", robots: { index: false } };

/**
 * The one-click way into the sample association.
 *
 * The front page's "Try the demo" lands here. Until 2026-10-05 the demo sat
 * under the sign-in form, so a visitor who wanted to look first was shown a
 * password field and had to find the sample seats below it.
 */
export default function Demo() {
  return <DemoEntry />;
}
