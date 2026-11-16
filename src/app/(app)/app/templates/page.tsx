import { TemplatesGallery } from "@/components/sharpflyer/templates-gallery";
import { listTemplates } from "@/server/templates";

export default async function TemplatesPage() {
  const templatesRes = await listTemplates();

  return (
    <TemplatesGallery
      templates={templatesRes.ok ? templatesRes.value : []}
      error={templatesRes.ok ? null : templatesRes.error}
    />
  );
}
