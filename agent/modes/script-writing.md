# Mode: script writing

**Trigger:** the user gives a topic, a link or a product page and wants a video, but no script.
Then continue in [script to motion](script-to-motion.md) with the approved script.

## Flow

1. **Research.** `pnpm dimensaz write "TOPIC" | URL --seconds N [--language ckb|en|…]`
   (default 30 s; the language of the page or topic, or the one the user names). Read
   `workspace/scripts/<name>/brief.md`: the facts you may use (each with its source sentence),
   the beats, the line and word budget, and the rules. A topic has no facts: the script then names
   no figures, prices, results or quotations. Report state `planning`.
2. **Write** `workspace/scripts/<name>/script.txt` yourself, one sentence a line, following the
   brief's beats:
   - **hook:** the problem, a true figure from the facts or a sharp question; no greeting;
   - **problem:** what it costs the viewer, concretely; a list of three reads as cards;
   - **solution:** name it once ("Meet …"), a change ("from X to Y", "turns X into Y"), the
     features as a list of three;
   - **proof:** one figure, price or quotation from the facts, on its own line;
   - **call to action:** a verb and when ("Start your free trial today").

   Never invent a figure, a customer, a review, a quotation or a superlative; quotations word for
   word. Kurdish in Sorani Arabic script as people speak it; product names as the brand writes them.
3. **Check** `pnpm dimensaz write --check workspace/scripts/<name>/script.txt`. Fix every hard
   issue (length, hook, call to action, a figure or quotation not in the facts) and the soft ones
   that make sense; `lines` shows the visual the designer will give each line: aim for variety
   (a list, a change, a figure, a quote). Check again until it passes.
4. **Show the script** to the user with the check's length and the facts it used, and wait for
   approval or changes. Report state `needs-approval`.
5. **Make** `pnpm dimensaz make workspace/scripts/<name>/script.txt` (`--voice` only when
   narration was asked for), then continue as in script to motion (preview, approval, final).
