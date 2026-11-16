import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function MyFlyersPlaceholderPage() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col items-center justify-center gap-4 px-5 py-16 text-center md:px-8 lg:px-10">
      <h1 className="text-h2 text-foreground">No flyers yet</h1>
      <p className="max-w-sm text-small text-muted-foreground">
        Choose a design from the gallery to create your first promotional flyer.
      </p>
      <Button asChild variant="default">
        <Link href="/app/templates">Choose a design</Link>
      </Button>
    </div>
  );
}
