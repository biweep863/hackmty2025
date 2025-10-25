"use client";

import { ReactNode, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink } from "@trpc/client";
import { trpc } from "~/utils/trpc";
import SuperJSON from "superjson";

function getBaseUrl() {
  if (typeof window !== "undefined") return "";
  return "http://localhost:3000"; // ajusta según tu entorno
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  const [trpcClient] = useState(() =>
    trpc.createClient({
      links: [
        httpBatchLink({
          url: `${getBaseUrl()}/api/trpc`,
          fetch: (input, init) =>
            fetch(input, { ...init, credentials: "include" }),
        }),
      ],
      transformer: SuperJSON,
    }),
  );

  return (
    <html lang="es">
      <body>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            {children}
          </QueryClientProvider>
        </trpc.Provider>
      </body>
    </html>
  );
}
