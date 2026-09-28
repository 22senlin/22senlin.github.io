# how to write a post for this blog

Voice laws, cut laws, and the mechanics. Rules here were paid for with deletion rounds — do not relearn them.

## voice

- **Third person, flat, explanatory.** State the mechanic and why it holds, then stop.
- Practitioners are "he" / "they" / "a man". The opponent is "he".
- **No first person** in analytical essays. First person is allowed only in testimonial/confessional posts, where the *I* is the substance.
- **No second-person coaching** at the reader. The post is not telling anyone what to do.
- Plain speech over clever. If a line needs decoding, it is the wrong line.

## what gets deleted

- **Framing flourishes** — the sentence that sets the point up before the point ("Aim is a hardware problem…"). Keep the hard claim, drop the run-up.
- **Significance inflation** — any line whose job is to tell the reader the thing matters: "and it is not small — ", "X is not a memory, it is the shape of the room", sweeping closers that scale the claim up ("the price of everything he will choose afterwards"). Cut the whole line, not just the clause.
- **Cute closers.**
- **Sermon sections** — life-lesson tangents, the job/apartment/partner riff, "what actually transfers". One topic per section.
- **Anecdote-example paragraphs** under a claim.

## shape

- **Tiny.** The landed essays are 12–18 short paragraphs. Default short and hard; expand only when asked.
- **Fewer paragraph breaks, not more.** Merge related sentences into real multi-sentence paragraphs. Keep only true punch lines standalone. This is a writing change — never fix it with CSS (the `p` margin stays 18px).
- **Headings are optional.** Lowercase `<h3>` sections are the default, but they can be stripped entirely; when in doubt, ask which.
- **End flat**, on the hard claim, not on a summary.

## mechanics

1. Everything lives in `src/posts.jsx`. Adding or rewriting a post touches that one file — nothing else is wired up.
2. Insert at the top of the array, newest first: `{slug, date, en: {title, excerpt, content}, zh: {...}}`. There is no top-level `title`/`excerpt`.
3. `date` = the day it is written (`date +%F`).
4. `content` is JSX: `<>` of `<p>` and optional `<h3>`. Only `{`, `}`, `<`, `>` are special — apostrophes, quotes and em dashes are fine as written. No TypeScript syntax anywhere in this repo.
5. **Excerpt: tiny, and often literally the words he gives.** Do not craft a paraphrase — a paraphrase rounds trips. Translate it too.
6. **Write `zh` in the same pass**, same paragraph breaks, same headings, same register — never a loose summary. A missing `zh` does not error; it silently shows English behind the 中文 toggle.

## rounds

- Expect **4–6 deletion rounds**. He pastes the offending lines back verbatim.
- Delete exactly what was pasted. **Never re-add a rewrite of it**, and fix the sentence left dangling so the remainder stands alone.
- When he flags one line as the problem, **grep the post for the same move elsewhere** and cut the class, not just the instance.
- "Take him literally first" — if he says the excerpt should literally be X, the excerpt is X.

## verify

`npm run build`, then grep the bundle for the slug, an English marker, and a **zh** marker (`grep -o '<marker>' dist/assets/index-*.js`) — the slug alone does not prove the translation shipped. No dev server, no browser vision.
