import Link from "next/link";
import { auth } from "~/server/auth";
import { HydrateClient } from "~/trpc/server";

export default async function Home() {
  const session = await auth();

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#2e026d] to-[#15162c] text-white">
        <header className="container mx-auto flex items-center justify-between px-4 py-6">
          <h1 className="text-2xl font-bold">My T3 App</h1>
          <nav className="flex gap-4">
            <Link href="/" className="hover:underline">
              Home
            </Link>
            <Link href="/about" className="hover:underline">
              About
            </Link>
            <Link href="/dashboard" className="hover:underline">
              Dashboard
            </Link>
          </nav>
        </header>

        <section className="container mx-auto flex-1 px-4 py-12">
          <div className="rounded-xl bg-white/5 p-6">
            <h2 className="mb-4 text-2xl font-semibold">Welcome</h2>
            <p className="mb-6">
              Use this area to render components or link to other pages in your
              app.
            </p>

            <div className="mb-6">
              {session ? (
                <div className="flex items-center gap-4">
                  <span>
                    Signed in as {session.user?.name ?? session.user?.email}
                  </span>
                  <Link
                    href="/api/auth/signout"
                    className="text-sm text-blue-200 hover:underline"
                  >
                    Sign out
                  </Link>
                </div>
              ) : (
                <Link
                  href="/api/auth/signin"
                  className="text-sm text-blue-200 hover:underline"
                >
                  Sign in
                </Link>
              )}
            </div>

            {/* Example links to components/pages you might create */}
            <div className="grid gap-4 sm:grid-cols-2">
              <Link
                href="/components/button"
                className="block rounded bg-white/10 p-4 hover:bg-white/20"
              >
                Button component
              </Link>
              <Link
                href="/pages/example"
                className="block rounded bg-white/10 p-4 hover:bg-white/20"
              >
                Example page
              </Link>
            </div>
          </div>
        </section>

        <footer className="py-6 text-center text-sm opacity-80">
          © {new Date().getFullYear()} My T3 App
        </footer>
      </main>
    </HydrateClient>
  );
}
