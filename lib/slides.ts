// Markdown for the text blocks that open and close a built talk.
// Are.na text blocks render markdown, so header tags set the size.

export const PRESENTER_NAME = "Charles Broskoski";
export const PRESENTER_EMAIL = "cab@are.na";

/** Metadata key on generated text blocks so re-running a build finds them instead of duplicating them. */
export const SLIDE_KEY = "talks_slide";
/** On section blocks: the id of the topic channel the section introduces. */
export const SECTION_KEY = "talks_section";
export type SlideKind = "title" | "section" | "end";

export function formatTalkDate(date: Date): string {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

export function titleSlide(title: string, date: Date): string {
  return [`# ${title}`, "", `## ${formatTalkDate(date)}`, "", `${PRESENTER_NAME}  `, PRESENTER_EMAIL].join("\n");
}

/** Marks the start of one picked channel's blocks. */
export function sectionSlide(title: string): string {
  return `# ${title}`;
}

export function endSlide(channelUrl: string): string {
  return ["# THE END", "", channelUrl].join("\n");
}
