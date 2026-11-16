import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 360, height: 800 } });

test("sign in, choose a template, generate a preview, refresh, and export", async ({ page }) => {
  await page.goto("/auth?next=/app/templates");
  await page.getByLabel("Email address").fill("m1-owner@solar.ng");
  await page.getByRole("button", { name: "Sign in with email" }).click();

  await expect(page).toHaveURL(/\/app\/templates$/);
  await expect(page.getByRole("heading", { name: "Templates" })).toBeVisible();
  await expect(page.getByTestId("template-tile-solar-bold-001")).toBeVisible();

  await page.getByTestId("template-tile-solar-bold-001").click();
  await expect(page).toHaveURL(/\/app\/templates\/solar-bold-001$/);
  await page.getByRole("button", { name: "Use this design" }).click();

  await expect(page).toHaveURL(/\/app\/create\/[a-f0-9-]+$/);
  await page.getByLabel("Headline").fill("Weekend solar sale");
  await page.getByLabel("Business name").fill("Sun Co");
  await page.getByRole("button", { name: "Generate flyer" }).click();

  await expect(page.getByText("Preview ready")).toBeVisible({ timeout: 30_000 });
  await page.reload();
  await expect(page.getByLabel("Headline")).toHaveValue("Weekend solar sale");

  await page.getByRole("button", { name: "Export flyer" }).first().click();
  await expect(page.getByText("Balance after export")).toBeVisible();
  await page.getByRole("button", { name: "Export flyer" }).last().click();
  await expect(page.getByText("Flyer exported")).toBeVisible({ timeout: 30_000 });
});
