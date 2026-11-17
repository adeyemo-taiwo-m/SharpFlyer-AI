import { MyFlyers } from "@/components/sharpflyer/my-flyers";
import { listUserFlyers } from "@/server/flyers";

export default async function MyFlyersPage() {
  const flyersRes = await listUserFlyers();
  if (!flyersRes.ok) return <div className="mx-auto max-w-[720px] px-5 py-8 text-body text-danger-text">{flyersRes.error.message}</div>;
  return <MyFlyers flyers={flyersRes.value} />;
}
