// The tab title. The page itself is a client component, which cannot
// export metadata, so the name lives here beside it.
export const metadata = { title: "Settings" };

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
