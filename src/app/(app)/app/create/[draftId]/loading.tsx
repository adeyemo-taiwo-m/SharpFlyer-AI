export default function FlyerEditorLoading() {
  return (
    <div className="flex min-h-[calc(100dvh-56px)] flex-col gap-4 p-4 md:p-6 lg:flex-row lg:p-8">
      <div className="min-h-[360px] flex-1 animate-pulse rounded-[28px] bg-surface" />
      <div className="flex w-full flex-col gap-4 lg:w-[420px]">
        <div className="h-10 w-64 animate-pulse rounded-full bg-surface" />
        <div className="h-12 animate-pulse rounded-xl bg-surface" />
        <div className="h-28 animate-pulse rounded-xl bg-surface" />
        <div className="h-12 animate-pulse rounded-xl bg-surface" />
      </div>
    </div>
  );
}
