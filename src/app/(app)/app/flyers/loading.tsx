export default function MyFlyersLoading() {
  return <div className="mx-auto flex w-full max-w-[1120px] flex-wrap gap-5 px-5 py-8 md:px-8 lg:px-10">{Array.from({ length: 6 }, (_, index) => <div key={index} className="flex basis-full flex-col gap-3 sm:basis-[calc(50%-0.625rem)] lg:basis-[calc(33.333%-0.84rem)]"><div className="aspect-square animate-pulse rounded-[20px] bg-surface" /><div className="h-5 w-3/4 animate-pulse rounded-full bg-surface" /><div className="h-4 w-1/2 animate-pulse rounded-full bg-surface" /></div>)}</div>;
}
