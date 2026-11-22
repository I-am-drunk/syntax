# Working on Syntax

Recreate Brilliant's authenticated experience, especially computer science
lessons, with matching layout, typography, interactions, motion and sound.
The product name is Syntax. Local pricing, credits and content locks are omitted.
Do not introduce other visual changes without evidence or user direction.

Coddy is paused in `CODDY/on-hold/`. Do not resume or import it into the new app.
Read `docs/COORDINATION.md` and `docs/RECON.md` before changing active work.
Use the existing two top-level T3 threads. Do not create extra agents or threads.
Keep each file-writing call below about 40 lines; append in separate calls.

Do reconnaissance and independent review before implementation. Challenge each
other's assumptions with evidence, a smaller alternative and a disconfirming test.
Prefer the smallest working design. Do not build a framework for hypothetical use.
Keep observed behavior, local experiments, inferences and unknowns distinct.
Never describe a screenshot, passing build or schema check as complete parity.

Keep one lesson runtime. The separate authoring MCP must use that runtime rather
than duplicate components or CSS. Authoring and verification live in sibling
folders documented in COORDINATION; test-only code must stay outside the app.
Use the comparison and recovery gates in `docs/UI-VERIFICATION.md`.
Preserve failed generation trials and fix the evidenced cause before retrying.

Match actual media and timing. Do not invent effects, glow, sounds or AI responses.
Unknown mechanics and inaccessible lesson bodies are explicit gaps, not fake
completion or decorative stand-ins. Keep the future backend small and replaceable.

Read `/home/tjninja/AGENTS.md` for the saved Google Chrome session. Use a separate
owned tab. Keep credentials and signed URLs out of output, source and documents.
Preserve the Tailscale preview. Keep docs concise and current. Use no em dashes.
