import { test, expect } from "@playwright/test";
import { SEATS, expectHealthy, seedSession } from "./helpers";

/**
 * Filing a document, in the demo.
 *
 * The demo keeps the name and size and drops the bytes, which is the whole of
 * what a browser can do with no server. What this proves is that an upload
 * shows up, can be published, and can be taken back.
 */
test.describe("documents", () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { seat: SEATS.president, view: "board" });
  });

  test("an upload is listed, kept to the board, removed and brought back", async ({ page }) => {
    await page.goto("/board/documents");
    await expectHealthy(page, "documents");

    await page.getByLabel("Upload documents").setInputFiles({
      name: "Board minutes, August.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.4 minutes"),
    });
    const row = page.getByText("Board minutes, August", { exact: true });
    await expect(row, "the upload did not appear").toBeVisible();

    // Two audiences, owners and the board. "Public" was a third choice with
    // no public page behind it.
    await page.getByLabel("Who can see Board minutes, August").selectOption("board");
    await expect(page.getByText("Board minutes, August is now board only")).toBeVisible();

    await page.getByLabel("Remove Board minutes, August").click();
    await expect(row).toHaveCount(0);
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(row, "undo did not bring it back").toBeVisible();

    await expectHealthy(page, "documents after filing");
  });

  test("a file the browser would not accept is refused with a reason", async ({ page }) => {
    await page.goto("/board/documents");
    await page.getByLabel("Upload documents").setInputFiles({
      name: "empty.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.alloc(0),
    });
    await expect(page.getByText("empty.pdf: The file is empty")).toBeVisible();
    await expect(page.getByText("empty", { exact: true })).toHaveCount(0);
  });
});
