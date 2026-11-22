# Syntax

Syntax is being rebuilt around Brilliant's authenticated learning experience,
with particular care for computer science lessons. The target is matching
appearance, interactions, animation, sound, loading, scrolling and recovery.
The intentional differences are Syntax branding and a local curriculum without
pricing, credit limits or content locks.

The [preferences preview](https://iris-1.javanese-mercat.ts.net:8446/settings/preferences/)
implements the header, menu and a small local preferences API.
[Writing Programs](https://iris-1.javanese-mercat.ts.net:8446/courses/thinking-in-code/first-steps-cs/tappy-onboarding-tic/)
now contains the introduction, four editable truck puzzles, the conclusion,
and three robot questions that check command order.
The player retains visited scenes, supports retry and replay, and counts each
solved puzzle once during the open lesson. Incorrect check answers can advance
without earning XP. Desktop lesson controls now use the captured button spacing,
press and focus styles, feedback entry and border glow. Their measured behavior
matches the bounded comparison; full-page visual matching remains incomplete.
Answered check questions also offer a report form with screenshots, annotations
and attachments. Reports save privately on this machine. Failed saves retain
the draft; ordinary dismissal clears it. Screenshot rendering and native screen
recording still have documented verification limits.
[Home](https://iris-1.javanese-mercat.ts.net:8446/home/)
and [Topics](https://iris-1.javanese-mercat.ts.net:8446/courses/) use captured content
and artwork. Desktop topic groups open and close without resetting their expanded
course rows or carousel positions. The Thinking in Code outline supports selection across its nine
levels. Only Writing Programs launches a lesson; other entries explicitly
report that their preview is unavailable. Home activity is a captured snapshot,
not persistent learner progress.
The Home activity card now includes its captured league badge. Lesson backgrounds,
feedback and Run/Stop controls follow the selected dark or light appearance.
Editing, result and Continue cues use the captured files and the sound-effects setting.
Finish shows the local score screen. Lesson answers and completion now save
privately on this machine, with Retry after a failed save. Returning from the
score screen waits for an accepted save and a matching readback. Reloading starts
a fresh editor and session XP; saved outcomes do not yet update course cards.
Tutor help, streak/league screens, audible timing and broader device behavior
remain unfinished or unverified.
This is a scoped preview, not a claim of complete Brilliant parity.

CSS and React updates over the Tailscale hostname were verified through its
actual WebSocket without reloading the page. Comparison reports and failures
are kept in `../syntax-pipeline/runs/`.

The earlier Coddy implementation is preserved in [CODDY/on-hold](CODDY/on-hold/).
Its live preview remains at https://iris-1.javanese-mercat.ts.net:8445.
That preview is archived work; it is not a finished Brilliant recreation.

Reconnaissance established that Brilliant combines structured lesson pages
with compiled Elm interactives. The first captured CS lesson contains six pages
and ten interactive modules. Its manifest does not expose puzzle parameters.
The current grid runtime supports forward, left and right commands. The static
conclusion's while/if illustration does not add executable loops or conditions.

The course-authoring MCP is a separate system at `../syntax-authoring`.
It will reuse the same vetted lesson components as this app. Reference captures,
comparison tests and actual generation trials belong in `../syntax-pipeline`.
Neither an MCP nor a skill can establish quality without checking its outputs.

Read [the evidence and open questions](docs/RECON.md),
[the small architecture](docs/ARCHITECTURE.md),
[verification rules](docs/UI-VERIFICATION.md), and
[ownership and coordination](docs/COORDINATION.md).
