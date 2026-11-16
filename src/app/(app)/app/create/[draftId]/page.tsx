import { notFound } from "next/navigation";

import { FlyerEditor } from "@/components/sharpflyer/flyer-editor";
import { getFlyerDraft } from "@/server/flyers";

export default async function FlyerEditorPage({
  params,
}: {
  params: Promise<{ draftId: string }>;
}) {
  const { draftId } = await params;
  const draftRes = await getFlyerDraft(draftId);
  if (!draftRes.ok) notFound();

  return (
    <FlyerEditor
      flyer={draftRes.value.flyer}
      template={draftRes.value.template}
      initialPreviewUrl={draftRes.value.previewUrl}
    />
  );
}
