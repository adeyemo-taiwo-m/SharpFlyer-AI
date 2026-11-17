import Link from "next/link";

import { PublicDocument } from "@/components/sharpflyer/public-document";
import { Button } from "@/components/ui/button";

export default function ContactPage() {
  return <PublicDocument title="Contact" intro="SharpFlyer is being prepared for a focused pilot with Nigerian businesses."><section><h2 className="text-h3">Pilot support</h2><p className="mt-3">If you are part of the pilot, use the support contact shared in your invite. We are keeping this page free of an unverified mailbox until the support channel is confirmed.</p></section><section><h2 className="text-h3">Account help</h2><p className="mt-3">For account, flyer, credit, or payment questions, sign in and include the affected flyer title or payment reference in your support request. Never send a password, OTP code, or secret key.</p><Button asChild variant="brand" className="mt-5"><Link href="/auth">Sign in</Link></Button></section><section><h2 className="text-h3">Before launch</h2><p className="mt-3">The final public support address, response expectations, and escalation process will be published after the pilot operating workflow is confirmed.</p></section></PublicDocument>;
}
