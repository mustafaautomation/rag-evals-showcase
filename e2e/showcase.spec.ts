import { expect, test } from "@playwright/test";

test("landing lists ten industries and the honesty line", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("honesty")).toHaveText(
    "Replays recorded offline runs from the public repos; synthetic data; personal open-source demos.",
  );
  await expect(page.getByTestId("industry-tile")).toHaveCount(10);
  await expect(page.getByRole("link", { name: /Customer support/ })).toBeVisible();
  await expect(page.getByTestId("industry-tile").first()).toContainText("PASS");
  await expect(page.getByTestId("industry-tile").first()).toContainText("FAIL");
});

test("simulator replays support and the gate follows the variant", async ({ page }) => {
  await page.goto("/industries/support");
  await page.getByTestId("question-select").selectOption("q01");
  await expect(page.getByTestId("answer")).toContainText("$12");
  await expect(page.getByTestId("gate")).toHaveAttribute("data-status", "pass");
  const improved = (await page.getByTestId("answer").innerText()).trim();
  await expect(page.getByTestId("chunk").first()).toContainText("score not recorded");

  await page.getByTestId("variant-bad-retriever").click();
  await expect(page.getByTestId("gate")).toHaveAttribute("data-status", "fail");
  const broken = (await page.getByTestId("answer").innerText()).trim();
  expect(broken).not.toBe(improved);
  expect(broken.toLowerCase()).toContain("don't know");

  await page.getByTestId("replay").click();
  await expect(page.getByTestId("gate")).toBeHidden();
  await expect(page.getByTestId("gate")).toBeVisible();
  await expect(page.getByTestId("gate")).toHaveAttribute("data-status", "fail");
});

test("insurance replay shows a recorded retrieval score", async ({ page }) => {
  await page.goto("/industries/insurance");
  await expect(page.getByTestId("chunk").first()).toContainText(/score \d/);
  await page.getByTestId("variant-bad_retriever").click();
  await expect(page.getByTestId("gate")).toHaveAttribute("data-status", "fail");
});

test("overview heatmap marks pass and fail from the reports", async ({ page }) => {
  await page.goto("/overview");
  await expect(page.getByRole("radio", { name: "Gated variant" })).toBeChecked();
  await expect(page.getByTestId("heat-support-hit_rate-gated")).toHaveAttribute("data-status", "pass");
  await page.getByRole("radio", { name: "Bad retriever" }).check();
  await expect(page.getByTestId("heat-support-hit_rate-bad")).toHaveAttribute("data-status", "fail");
  await expect(page.getByText("needs API key — not measured").first()).toBeVisible();
});

test("pages do not scroll sideways", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/overview", "/industries/support"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow, path).toBeLessThanOrEqual(1);
  }
});
