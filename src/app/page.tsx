export default function Home() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-6">
      <div className="w-full max-w-2xl rounded-2xl bg-surface p-8 shadow-2 sm:p-12">
        <p className="text-callout text-brand-text">SharpFlyer AI</p>
        <h1 className="mt-4 max-w-xl text-display">Sharp flyers, sharp sharp.</h1>
        <p className="mt-6 max-w-prose text-body-lg text-muted-foreground">
          Pick a design. Add your details. Export a flyer you can post today.
        </p>
      </div>
    </main>
  );
}
