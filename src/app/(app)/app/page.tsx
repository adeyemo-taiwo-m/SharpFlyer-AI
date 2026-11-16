import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function AppHomePage() {
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-6 px-5 py-8 md:px-8 lg:px-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-h1 text-foreground">Welcome to SharpFlyer</h1>
        <p className="max-w-prose text-body text-muted-foreground">
          Pick a design, add your business details, and export a flyer with your price and phone number always accurate.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="brand" size="lg">
          <Link href="/app/templates">Choose a design</Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link href="/app/flyers">My flyers</Link>
        </Button>
      </div>
    </div>
  );
}
