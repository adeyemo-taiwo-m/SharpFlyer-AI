import { TemplatesGallery } from "@/components/sharpflyer/templates-gallery";
import { listTemplates } from "@/server/templates";

export default async function TemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const templatesRes = await listTemplates();
  const params = await searchParams;
  const initialCategory = params.category?.trim().toLowerCase() || "all";

  return (
    <TemplatesGallery
      templates={templatesRes.ok ? templatesRes.value : []}
      error={templatesRes.ok ? null : templatesRes.error}
      initialCategory={initialCategory}
    />
  );
}
