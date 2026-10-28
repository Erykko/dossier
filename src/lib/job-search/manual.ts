import "server-only";

import { PostingSource } from "@/generated/prisma/enums";
import { fetchHtml, postingFacts, postingFromHtml, FETCH_MESSAGES } from "@/lib/posting-fetch";

import { linkKey, type FoundPosting } from "./search";

// A posting added by hand on the Jobs screen: a link the user found anywhere,
// read once and kept in Saved like a search result, so an application can be
// started from it. Its link is its id, so adding it again finds the same one.

const cut = (text: string, length: number) => text.trim().slice(0, length);

/** The posting at `link` as Find jobs keeps postings, or why it can't be read. */
export async function postingFromLink(link: string): Promise<{ ok: true; posting: FoundPosting } | { ok: false; error: string }> {
  const page = await fetchHtml(link.trim());
  if (!page.ok) return { ok: false, error: page.error };
  const text = postingFromHtml(page.html);
  if (!text) return { ok: false, error: FETCH_MESSAGES.unreadable };
  const facts = postingFacts(page.html);
  const host = new URL(page.url).hostname.replace(/^www\./, "");
  return {
    ok: true,
    posting: {
      source: PostingSource.MANUAL,
      externalId: cut(linkKey(page.url) || page.url, 500),
      title: cut(facts.title, 500) || "Job posting",
      company: cut(facts.company, 300),
      place: cut(facts.place, 300),
      remote: facts.remote,
      salary: cut(facts.salary, 200),
      postedAt: facts.postedAt,
      url: page.url,
      via: cut(host, 100),
      description: cut(text.text, 100_000),
      complete: true,
    },
  };
}
