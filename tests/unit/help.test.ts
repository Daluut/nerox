import { describe, expect, it } from "vitest";
import { HELP, searchHelp } from "@/lib/ai/help";

describe("Nerox AI help guide", () => {
  it("finds the right article for everyday questions", () => {
    expect(searchHelp("what does the pulse weighting in settings do")[0].id).toBe("weighting");
    expect(searchHelp("how do I invite my team")[0].id).toBe("invite");
    expect(searchHelp("what is what if?")[0].id).toBe("whatif");
    expect(searchHelp("what is memory")[0].id).toBe("memory");
    expect(searchHelp("how much does it cost")[0].id).toBe("pricing");
  });

  it("returns nothing for unrelated questions instead of guessing", () => {
    expect(searchHelp("best pizza in london")).toEqual([]);
  });

  it("has unique ids and links to real pages", () => {
    expect(new Set(HELP.map((h) => h.id)).size).toBe(HELP.length);
    for (const h of HELP) if (h.link) expect(h.link.href.startsWith("/")).toBe(true);
  });
});
