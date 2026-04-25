import { describe, it, expect } from "vitest";
import { extractCiteLabel, isCiteRelevant, buildCites, type CiteSource } from "./keeperCites";

describe("extractCiteLabel", () => {
  it("prefers metadata.name when present", () => {
    const r: CiteSource = {
      text: "irrelevant",
      imageUrl: "images/x.png",
      meta: { name: "lai", type: "ship" },
    };
    expect(extractCiteLabel(r)).toEqual({ label: "LAI", entityType: "ship" });
  });

  it("falls back to ship_name metadata", () => {
    const r: CiteSource = {
      text: "irrelevant",
      imageUrl: null,
      meta: { ship_name: "Reflex", type: "ship" },
    };
    expect(extractCiteLabel(r)).toEqual({ label: "REFLEX", entityType: "ship" });
  });

  it("parses 'Ship: NAME.' pattern from text", () => {
    const r: CiteSource = {
      text: "Ship: LAI. Class: Frigate. The LAI is the standard light frigate.",
      imageUrl: "images/lai.png",
    };
    expect(extractCiteLabel(r)).toEqual({ label: "LAI", entityType: "ship" });
  });

  it("parses 'Structure: NAME.' pattern", () => {
    const r: CiteSource = {
      text: "Structure: SSU. A primary inventory container.",
      imageUrl: null,
    };
    expect(extractCiteLabel(r)).toEqual({ label: "SSU", entityType: "structure" });
  });

  it("falls back to filename when no metadata or pattern matches", () => {
    const r: CiteSource = {
      text: "Some random text about a thing without a clear class header.",
      imageUrl: "https://keeper.reapers.shop/images/lorha.png",
    };
    expect(extractCiteLabel(r)).toEqual({ label: "LORHA", entityType: undefined });
  });

  it("strips multiple image extensions correctly", () => {
    expect(extractCiteLabel({ text: "x", imageUrl: "a/b/wend.PNG" }).label).toBe("WEND");
    expect(extractCiteLabel({ text: "x", imageUrl: "carom.jpeg" }).label).toBe("CAROM");
    expect(extractCiteLabel({ text: "x", imageUrl: "haf.webp" }).label).toBe("HAF");
  });

  it("returns empty label when no signal is available", () => {
    expect(extractCiteLabel({ text: "no name", imageUrl: null }).label).toBe("");
  });
});

describe("isCiteRelevant", () => {
  const baseR: CiteSource = { text: "x", imageUrl: "y" };

  it("returns true when query contains the label (case-insensitive)", () => {
    expect(isCiteRelevant(baseR, "LAI", "what is a lai")).toBe(true);
    expect(isCiteRelevant(baseR, "LAI", "WHAT IS A LAI")).toBe(true);
    expect(isCiteRelevant(baseR, "lorha", "tell me about LORHA cargo")).toBe(true);
  });

  it("returns false when query does NOT contain the label", () => {
    expect(isCiteRelevant(baseR, "LORHA", "what is a lai")).toBe(false);
    expect(isCiteRelevant(baseR, "MAUL", "tell me about ships")).toBe(false);
  });

  it("returns true when distance is tight even if label not in query", () => {
    expect(isCiteRelevant({ ...baseR, distance: 0.32 }, "LORHA", "what is a lai")).toBe(true);
    expect(isCiteRelevant({ ...baseR, distance: 0.44 }, "LORHA", "what is a lai")).toBe(true);
  });

  it("returns false when distance is loose AND label not in query", () => {
    expect(isCiteRelevant({ ...baseR, distance: 0.46 }, "LORHA", "what is a lai")).toBe(false);
    expect(isCiteRelevant({ ...baseR, distance: 0.7 }, "LORHA", "what is a lai")).toBe(false);
  });

  it("returns true for community-confirmed submissions with consensus >= 2", () => {
    expect(isCiteRelevant({
      ...baseR, source: "player_submission", consensusCount: 2,
    }, "X", "unrelated query")).toBe(true);
    expect(isCiteRelevant({
      ...baseR, source: "player_submission", consensusCount: 5,
    }, "X", "unrelated query")).toBe(true);
  });

  it("returns false for single-consensus player submissions", () => {
    expect(isCiteRelevant({
      ...baseR, source: "player_submission", consensusCount: 1,
    }, "X", "unrelated query")).toBe(false);
  });

  it("returns false for empty label regardless of other conditions", () => {
    expect(isCiteRelevant({ ...baseR, distance: 0.1 }, "", "anything")).toBe(false);
  });

  it("avoids spurious 1-char label matches", () => {
    // A 1-char label in the query is too noisy (e.g. label "A" matching everything)
    expect(isCiteRelevant(baseR, "A", "what is a lai")).toBe(false);
  });
});

describe("buildCites — end to end", () => {
  it("filters out irrelevant ships from a 'what is a lai' query", () => {
    const results: CiteSource[] = [
      { text: "Ship: LAI. Light frigate.", imageUrl: "https://x/images/lai.png", meta: { type: "ship" }, distance: 0.21 },
      { text: "Ship: LORHA. Hauler.",      imageUrl: "https://x/images/lorha.png", meta: { type: "ship" }, distance: 0.55 },
      { text: "Ship: MAUL. Battlecruiser.",imageUrl: "https://x/images/maul.png", meta: { type: "ship" }, distance: 0.62 },
      { text: "Ship: REFLEX. Frigate.",    imageUrl: "https://x/images/reflex.png", meta: { type: "ship" }, distance: 0.71 },
    ];
    const cites = buildCites(results, "what is a lai");
    expect(cites).toHaveLength(1);
    expect(cites[0].label).toBe("LAI");
    expect(cites[0].url).toBe("https://x/images/lai.png");
  });

  it("returns multiple cites when multiple results pass the relevance gate", () => {
    const results: CiteSource[] = [
      { text: "Ship: LAI.",   imageUrl: "https://x/images/lai.png",   distance: 0.21 },
      { text: "Ship: LORHA.", imageUrl: "https://x/images/lorha.png", distance: 0.30 },  // distance < 0.45
      { text: "Ship: MAUL.",  imageUrl: "https://x/images/maul.png",  distance: 0.80 },
    ];
    const cites = buildCites(results, "what is a lai");
    expect(cites).toHaveLength(2);
    expect(cites.map(c => c.label)).toEqual(["LAI", "LORHA"]);
  });

  it("dedupes by URL", () => {
    const results: CiteSource[] = [
      { text: "Ship: LAI. variant 1.", imageUrl: "https://x/images/lai.png", distance: 0.21 },
      { text: "Ship: LAI. variant 2.", imageUrl: "https://x/images/lai.png", distance: 0.22 },
      { text: "Ship: LAI. variant 3.", imageUrl: "https://x/images/lai.png", distance: 0.23 },
    ];
    const cites = buildCites(results, "what is a lai");
    expect(cites).toHaveLength(1);
  });

  it("respects maxCites cap", () => {
    const results: CiteSource[] = Array.from({ length: 10 }, (_, i) => ({
      text: `Ship: SHIP${i}.`,
      imageUrl: `https://x/images/ship${i}.png`,
      distance: 0.2,
    }));
    const cites = buildCites(results, "anything", 3);
    expect(cites).toHaveLength(3);
  });

  it("returns empty array when no results pass the gate", () => {
    const results: CiteSource[] = [
      { text: "Ship: LORHA.", imageUrl: "https://x/images/lorha.png", distance: 0.7 },
      { text: "Ship: MAUL.",  imageUrl: "https://x/images/maul.png",  distance: 0.8 },
    ];
    const cites = buildCites(results, "what is a lai");
    expect(cites).toHaveLength(0);
  });

  it("returns empty array when no results have images", () => {
    const results: CiteSource[] = [
      { text: "Ship: LAI.", imageUrl: null, distance: 0.1 },
    ];
    const cites = buildCites(results, "what is a lai");
    expect(cites).toHaveLength(0);
  });
});
