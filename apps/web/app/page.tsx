import Link from "next/link";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 bg-neutral-900 text-slate-100">
      <h1 className="text-5xl font-bold">Drone Dude</h1>
      <Link
        href="/ai"
        className="rounded-lg bg-indigo-600 px-6 py-3 text-lg font-semibold transition-colors hover:bg-indigo-500"
      >
        Start
      </Link>
    </main>
  );
}
