// Markdown for the text blocks that open and close a built talk.
// Are.na text blocks render markdown, so header tags set the size.

export const PRESENTER_NAME = "Charles Broskoski";
export const PRESENTER_EMAIL = "cab@are.na";

/** Metadata key on generated text blocks so re-running a build finds them instead of duplicating them. */
export const SLIDE_KEY = "talks_slide";
/** On section blocks: the id of the topic channel the section introduces. */
export const SECTION_KEY = "talks_section";
export type SlideKind = "title" | "section" | "end";

/** Talks happen in New York time; the server runs in UTC. */
const TALK_TIME_ZONE = "America/New_York";

/** "October 5th, 2026" */
export function formatTalkDate(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TALK_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  const day = Number(get("day"));
  const mod100 = day % 100;
  const suffix = mod100 >= 11 && mod100 <= 13 ? "th" : (["th", "st", "nd", "rd"][day % 10] ?? "th");
  return `${get("month")} ${day}${suffix}, ${get("year")}`;
}

/**
 * Title, a rule, then presenter / date / email as one paragraph. Are.na renders
 * single newlines inside a paragraph as line breaks, so no blank lines between them.
 */
export function titleSlide(title: string, date: Date): string {
  return [`# ${title}`, "---", PRESENTER_NAME, formatTalkDate(date), PRESENTER_EMAIL].join("\n");
}

/** Marks the start of one picked channel's blocks. */
export function sectionSlide(title: string): string {
  return `# ${title}`;
}

export function endSlide(channelUrl: string): string {
  return ["# THE END", "", channelUrl].join("\n");
}
