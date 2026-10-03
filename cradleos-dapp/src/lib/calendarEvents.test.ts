import { describe, expect, it } from "vitest";
import { withoutRetiredCalendarEvents } from "./calendarEvents";

describe("retired calendar schedule", () => {
  it("removes persisted built-ins without changing player-created events or their order", () => {
    const userEvents = [
      { id: "custom-1", title: "Hackathon Begins", date: "2026-03-11" },
      { id: "hk-player-event", title: "Fleet", date: "2026-10-03" },
    ];
    const oldRows = ["hk-start", "hk-build", "hk-deadline", "hk-deploy", "hk-vote", "hk-judging", "hk-winners"]
      .map(id => ({ id, title: "Old schedule", date: "2026-03-11" }));
    const saved = [userEvents[0], ...oldRows, userEvents[1]];
    const cleaned = withoutRetiredCalendarEvents(saved);
    expect(cleaned).toEqual(userEvents);
    expect(cleaned[0]).toBe(userEvents[0]);
    expect(saved).toHaveLength(9);
    expect(withoutRetiredCalendarEvents(cleaned)).toEqual(cleaned);
  });

  it("does not seed a new calendar", () => {
    expect(withoutRetiredCalendarEvents([])).toEqual([]);
  });
});
