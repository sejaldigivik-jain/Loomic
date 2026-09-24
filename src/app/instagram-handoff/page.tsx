import { Suspense } from "react";
import InstagramHandoffClient from "./handoff-client";

export default function InstagramHandoffPage() {
  return (
    <Suspense fallback={<main className="mx-auto max-w-lg p-6">Preparing Story handoff…</main>}>
      <InstagramHandoffClient />
    </Suspense>
  );
}
