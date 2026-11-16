import { TemplateGallerySkeleton } from "@/components/sharpflyer/templates-gallery";

export default function TemplatesLoading() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-7 px-5 py-8 md:px-8 lg:px-10">
      <div className="flex flex-col gap-2">
        <div className="h-10 w-48 animate-pulse rounded-full bg-surface" />
        <div className="h-5 w-80 animate-pulse rounded-full bg-surface" />
      </div>
      <div className="h-12 max-w-xl animate-pulse rounded-xl bg-surface" />
      <TemplateGallerySkeleton />
    </div>
  );
}
