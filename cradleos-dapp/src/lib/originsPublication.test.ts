import { describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

const root = new URL("../../public/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("data/comics.json", root), "utf8"));

describe("Origins published film catalog", () => {
  it("keeps the Chapter 1 fallback and lists both chapters exactly once", () => {
    expect(manifest.featuredFilms.map((film: { id: string }) => film.id)).toEqual([
      "echoes-of-stillness-chapter-2-film", "echoes-of-stillness-chapter-1-film",
    ]);
    expect(manifest.featuredFilms[1]).toEqual(manifest.featuredFilm);
  });
  it("binds every public companion file to the declared hash", () => {
    for (const film of manifest.featuredFilms) {
      for (const key of ["poster", "captionsVtt", "transcript"]) {
        const bytes = readFileSync(new URL(film[key], root));
        expect(createHash("sha256").update(bytes).digest("hex")).toBe(film[`${key}Sha256`]);
      }
    }
  });
  it("uses the approved Chapter 2 MP4 and only the public streaming URL", () => {
    expect(manifest.featuredFilms[0].mediaSha256).toBe("4288982d54339a63b3eb404f828eec93dd91042e86816ae12bf7cc5d8b6f40a1");
    expect(manifest.featuredFilms[0].mediaUrl).toBe("https://cradleos.io/api/origins/chapter-2/video");
  });
});
