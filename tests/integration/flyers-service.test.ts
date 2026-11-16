import { beforeEach, describe, expect, it } from "vitest";

import {
  createDraftFromTemplate,
  exportFlyer,
  requestPreviewRender,
} from "@/server/flyers";
import { createAppError } from "@/lib/errors";
import { getBalance } from "@/server/credits";
import { createCoreDataStoreState } from "@/server/db/client";
import { createStorageServiceState } from "@/server/storage";
import type { RenderClient, RenderResponse } from "@/server/render/client";
import { err, ok } from "@/types/result";
import type { SessionUser } from "@/server/auth";

const USER: SessionUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner@solar.ng",
  emailVerified: true,
};

function renderClient(options: { fail?: boolean } = {}): RenderClient {
  return {
    async render(request) {
      if (options.fail) {
        return err({
          ...createAppError("RENDER_VALIDATION_FAILED"),
          issues: [
            {
              code: "CRITICAL_TEXT_MISMATCH",
              message: "price changed during layout.",
              field: "price",
              severity: "error",
            },
          ],
        });
      }

      const response: RenderResponse = {
        jobId: request.jobId,
        outputBuffer: Buffer.from(`rendered:${request.jobId}`),
        warnings: [],
        errors: [],
        metrics: { durationMs: 12, minFontSizeUsed: 42 },
      };
      return ok(response);
    },
  };
}

describe("Phase 4 flyer vertical slice", () => {
  let state = createCoreDataStoreState();
  let storageState = createStorageServiceState();

  beforeEach(() => {
    state = createCoreDataStoreState();
    storageState = createStorageServiceState();
  });

  async function createDraft() {
    const result = await createDraftFromTemplate(
      { templateId: "solar-bold-001", format: "ig_post", themeId: "navy-gold" },
      { sessionUser: USER, state, storageState },
    );
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.error.message);
    return result.value;
  }

  it("creates a draft, renders a preview, and never charges preview generation", async () => {
    const draft = await createDraft();
    const preview = await requestPreviewRender(draft.id, draft.content, {
      sessionUser: USER,
      state,
      storageState,
      renderClient: renderClient(),
    });

    expect(preview.ok).toBe(true);
    if (preview.ok) {
      expect(preview.value.previewUrl).toContain("/api/storage/download/");
      expect(preview.value.flyer.status).toBe("rendered");
    }

    expect(await getBalance(USER.id, { state })).toEqual({ ok: true, value: 3 });
  });

  it("charges one credit for a new export and makes repeated exports free", async () => {
    const draft = await createDraft();
    const first = await exportFlyer(draft.id, { fileType: "png", scale: 1 }, {
      sessionUser: USER,
      state,
      storageState,
      renderClient: renderClient(),
    });
    const second = await exportFlyer(draft.id, { fileType: "png", scale: 1 }, {
      sessionUser: USER,
      state,
      storageState,
      renderClient: renderClient(),
    });

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (first.ok && second.ok) {
      expect(first.value.reusedExisting).toBe(false);
      expect(second.value.reusedExisting).toBe(true);
      expect(first.value.downloadUrl).toContain("/api/storage/download/");
    }
    expect(await getBalance(USER.id, { state })).toEqual({ ok: true, value: 2 });
  });

  it("does not double-charge concurrent exports of the same draft", async () => {
    const draft = await createDraft();
    const results = await Promise.all([
      exportFlyer(draft.id, {}, { sessionUser: USER, state, storageState, renderClient: renderClient() }),
      exportFlyer(draft.id, {}, { sessionUser: USER, state, storageState, renderClient: renderClient() }),
    ]);

    expect(results.every((result) => result.ok)).toBe(true);
    expect(await getBalance(USER.id, { state })).toEqual({ ok: true, value: 2 });
  });

  it("refunds the credit when final render validation fails", async () => {
    const draft = await createDraft();
    const result = await exportFlyer(draft.id, {}, {
      sessionUser: USER,
      state,
      storageState,
      renderClient: renderClient({ fail: true }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("RENDER_VALIDATION_FAILED");
      expect(result.error.issues?.[0]?.code).toBe("CRITICAL_TEXT_MISMATCH");
    }
    expect(await getBalance(USER.id, { state })).toEqual({ ok: true, value: 3 });
  });
});
