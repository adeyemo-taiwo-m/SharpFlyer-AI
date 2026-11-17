import { describe, expect, it } from "vitest";

import { sanitizeAnalyticsProperties } from "@/server/analytics";

describe("analytics privacy boundary", () => {
  it("drops direct identifiers and keeps bounded primitive properties", () => {
    expect(sanitizeAnalyticsProperties({ format: "story", phone: "+2348000000000", businessName: "Private Co", count: 2 })).toEqual({ format: "story", count: 2 });
  });
});
