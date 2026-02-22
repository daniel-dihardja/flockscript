import { LiveEditor } from "@/components/editor/live-editor";

export default function Page() {
  return (
    <main className="min-h-svh bg-neutral-900 px-6 py-8 text-slate-100">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            FlockScript Live Editor
          </h1>
          <p className="text-sm text-muted-foreground">
            Evaluate blocks, lines, or selections with the keyboard. Blocks are
            separated by blank lines or --- markers.
          </p>
        </header>
        <section className="h-[70vh]">
          <LiveEditor />
        </section>
      </div>
    </main>
  );
}
