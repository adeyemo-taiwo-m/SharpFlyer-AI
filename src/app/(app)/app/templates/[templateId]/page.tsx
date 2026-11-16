import { notFound } from "next/navigation";

import { TemplateDetail } from "@/components/sharpflyer/template-detail";
import { getTemplate } from "@/server/templates";

export default async function TemplateDetailPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const templateRes = await getTemplate(templateId);
  if (!templateRes.ok) notFound();

  return <TemplateDetail template={templateRes.value.template} />;
}
