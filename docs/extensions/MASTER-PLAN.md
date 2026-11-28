# Syntax extensions master plan

Syntax will deliver the new extension system in several V1 milestones. Each milestone must produce something usable on Syntax Dev. Keep fixing and testing it there until its checks pass, then start the next milestone. V2 is the release that proves the complete system works together.

The V1.1 through V1.5 numbers below are proposed milestone names. The existing V1 runtime stays on Stable during the transition. The new runtime ships to Dev in increments and reaches students through Beta only after the relevant checks pass.

- [Milestones and release gates](#milestones-and-release-gates)
- [Release channels](#release-channels)
- [Documentation and the generated wiki](#documentation-and-the-generated-wiki)
- [Feedback index](#feedback-index)
- [V2.5 and later](#v25-and-later)

## Milestones and release gates

For each milestone, record its PRs, exact tested commit, preview and Dev links, test results, and open feedback in this plan. A PR can merge into `main` before the milestone closes. Only start the next milestone once this one passes on the deployed build. Fix regressions under the current milestone and rerun the affected checks. If a later build breaks an earlier check, fix it before closing the later milestone.

| Milestone | What you can use | Status |
| --- | --- | --- |
| [V1.1](#v11-native-extension-basics) | A standalone tool with its own screen, command, and recovery | Planned |
| [V1.2](#v12-course-ui-and-progress) | A real lesson and shared learning UI | Planned |
| [V1.3](#v13-embedded-extensions-tools-and-themes) | A course with required embedded behavior and an optional tool | Planned |
| [V1.4](#v14-publishing-discovery-and-docs) | A documented authoring, publishing, and install path | Planned |
| [V1.5](#v15-release-rehearsal) | A complete release rehearsal on the actual sites | Planned |
| [V2](#v2-release-gate) | The complete system after every gate passes | Planned |

### V1.1 Native extension basics

Build a small native React runtime for trusted extension code. Start with strict manifest validation, a host-provided API, extension-owned screens and commands, local storage, and cleanup on disable. Use an original standalone tool to prove the runtime is useful outside courses. Keep Sema in core. Reuse existing routing, command palette, error boundaries, and Sonner where they fit.

**Release gate**

- [ ] Install the tool from a link in a clean browser, find its page, and run its command. Reject an invalid manifest with a useful message.
- [ ] Disable and reinstall the tool. Its screen, commands, and listeners clean up, and its saved data is available again.
- [ ] Trigger a load or render error. Syntax identifies and disables the responsible extension and offers **Inspect** and **Re-enable** in a top-right desktop notification. Verify a restart with extensions skipped when startup was interrupted and the responsible extension is unclear. Same-page native code shares the browser thread, so a hard freeze can require a reload before recovery.
- [ ] Verify the Infra, Dev, Beta, and Stable boundaries before giving the build to users. Dev extension state and resets leave Stable state intact.

### V1.2 Course UI and progress

Publish `@syntax/api` for host services and `@syntax/ui` for shared controls and learning components. Syntax and installed extensions use the same live UI implementation. Start with what a complete lesson needs. Provide guidance, example grading, and reusable controls. Courses can supply their own grading and completion rules, use a custom interaction, or build a different layout. Keep mathematics, code editors, and other subject-specific engines in course packages or separate kits.

**Release gate**

- [ ] Complete a real MPM2D Analytic Geometry lesson on desktop and mobile, in light and dark mode, and using a keyboard. Check the graph axes, points, and line against the lesson background. Exercise the same shared components in a small example from another subject.
- [ ] Change a shared control in Syntax and verify that an installed example picks up the change without rebuilding the extension. During alpha and beta, update official extensions alongside breaking `@syntax/ui` changes. Commit to backward compatibility at the public UI API's v1.0.
- [ ] Show a progress count in Library when a course supplies one. Preserve it on reinstall. At the bottom of Profile, allow deleting one course's saved data without affecting other courses or the account.

### V1.3 Embedded extensions, tools, and themes

An embedded extension is required course-owned behavior. Represent it explicitly in course source when it needs setup, registration, or cleanup. Bundle it in the same course release. A standalone tool has its own install and can contribute an optional feature inside a course. Ordinary course styles apply within the course. A user-enabled theme can deliberately style the whole app.

**Release gate**

- [ ] A fresh course install includes every required interaction. Updating or disabling the course updates or removes its embedded behavior together.
- [ ] Install one real optional tool, such as Pen Studio or Formula Playbook, and use it in the course. Disable it while the course is open. The course still teaches and grades, and the optional control disappears cleanly. Course details can recommend the tool.
- [ ] Enable and disable a small theme and command extension. Verify app-wide styling only when enabled, removal of the styling and command on disable, and recovery if the extension throws.

### V1.4 Publishing, discovery, and docs

Give authors and agents two complete paths. **Build a Course** starts with a subject-neutral starter and one working lesson. **Build a Tool** adds a screen and a command. Both show how to build, publish, and install in Syntax Dev. Keep these guides in the same repo as the API. Fumadocs publishes them for the rolling Dev build. Storybook runs the component and example demos. Public repository skills give agents deeper instructions and evidence outside the docs site.

**Release gate**

- [ ] A new author or agent can follow either guide from a fresh checkout through a working install. Courses appear in Library and tools in their documented location after successful installs. Test Community Hub discovery and direct manifest links.
- [ ] Publish a build with separate listing screenshots. The course download contains the images needed in lessons. The listing carries its preview images. Attach a screenshot from the running app or generate it from an example that runs in Storybook.
- [ ] Verify compatible course and tool releases update automatically during alpha. A rejected build leaves the working install usable. Keep the full versioning and upgrade design for later.
- [ ] Test both tutorials, links, and Storybook examples from the release commit. Verify the site shows the Dev build it describes, while the two authoring guides, runnable source, and deeper agent instructions have stable source links.

### V1.5 Release rehearsal

Run the real official course, the optional tool, and the small theme and command extension through the same paths a student or author will use. Verify normal use on fresh and returning browser profiles, including installed content, preferences, progress, and failure recovery. Review the [historical UI feedback](#earlier-product-feedback) on the deployed build.

**Release gate**

- [ ] Pass `npm run build`, `npm run test:unit`, and `npm run test:e2e` for the candidate. Verify desktop and mobile behavior against the deployed commit as well as in CI.
- [ ] Verify a PR preview opens the right commit and leaves Dev alone. Manually deploy a merged commit to Dev without cutting a Nightly. Run a Nightly independently and verify its prerelease and docs point to the same source. Verify Beta publishes a regular release in Syntax and points to its separate student site. Stable stays on its intended build throughout.
- [ ] Walk through one student-facing Beta release and recovery. Record the exact commit, build and site links, review findings, and evidence for the previous gates. Resolve blockers before advancing.

### V2 release gate

- [ ] Every V1 milestone has a passed gate and linked evidence.
- [ ] The official course, optional tool, and theme and command extension work together on the release candidate. A fresh browser can install and use all three. At least one other subject works with the shared learning UI.
- [ ] The same candidate passes the release rehearsal, including docs, Beta publishing, and a same-browser check that preview and Dev activity cannot alter Stable data.
- [ ] The maintainer confirms the release. Tag the tested commit explicitly. Moving Stable to the new runtime is a separate release decision.

## Release channels

| Channel | Audience and source | Site and GitHub visibility |
| --- | --- | --- |
| Infra PR preview | Reviewers. Build the exact PR head on each eligible open or updated PR. | A separate hostname per PR, such as `pr-42.syntax-infra.pages.dev`. Update one bot comment with a rolling preview link, an exact build link, and the commit. It leaves Dev, Beta, and Stable untouched. |
| Dev on demand | Maintainer. Choose a merged `main` commit after reviewing the PR. | Deploy that commit to Syntax Dev without tagging or publishing a GitHub release. |
| Nightly | Maintainer. Automate from eligible `main` commits and allow a manual run. | Deploy to Syntax Dev and publish a GitHub **prerelease** in `syntax-platform/syntax`. Frequent Nightlies share one rolling docs destination. |
| Beta | Students and invited testers. Check for an eligible changed build every two days. | Deploy to the separate Beta domain. Publish a regular GitHub **release** in `syntax-platform/syntax` linking to the Beta site, even if the site is hosted from another repo. Set the release so Stable remains the default latest release. |
| Stable | Public. Explicit promotion of a tested commit. | Keep the existing site and release track. Beta and Nightly tags must stay outside Stable promotion during the transition. |

Use the existing release-notes generator for Beta. GitHub Models can summarize changes since the last Beta. Its output is release copy. The workflow determines which commit ships, applies the tests, and can fall back to deterministic notes. Use the same candidate commit for the artifact, site, tag, and release notes. A failed build or deployment must leave the last working Beta accessible.

For the Infra workflow, build PR code without deployment keys or production auth configuration. Publish only files from the resulting build, on an origin separate from the student and production sites. Start with branches in the Syntax repo and add fork publishing once the artifact and privileges are separated and verified. GitHub Pages project paths on `syntax-platform.github.io` share a browser origin. Paths alone do not isolate storage or cookies. Infra can acquire other jobs later without turning it into the source repo or moving the main release list.

T3 Code uses a separate, labeled PR preview workflow, keeps the nightly and production site aliases untouched during PR previews, and updates one comment with the exact build link. Its scheduled check can run more often than it publishes. The current release runbook describes a 30-minute check, a six-hour interval between automatic releases, a new-commits requirement, and manual dispatch. Use those channel boundaries as the reference for Syntax's different schedule. [T3 Code PR preview workflow](https://github.com/pingdotgg/t3code/blob/main/.github/workflows/web-preview.yml) · [T3 Code release runbook](https://github.com/pingdotgg/t3code/blob/main/docs/operations/03_release.md) · [GitHub Actions security guidance](https://docs.github.com/en/actions/reference/security/secure-use)

### Deployment setup and cutover

1. **Dev.** The `syntax-dev` repository serves the original [public Dev URL](https://syntax-platform.github.io/syntax-dev/) directly from `gh-pages`. Both Dev workflows publish to this repository. The stable app stays at [/syntax/](https://syntax-platform.github.io/syntax/). Verify hash routes and Clerk sign-in during the first workflow run.
2. **Infra.** Keep infrastructure configuration in `syntax-infra`. The Cloudflare Pages project also uses `syntax-infra` and gives each PR a separate browser origin. Set `SYNTAX_INFRA_ORIGIN` to the assigned project origin. Verify that a same-repo PR comment updates on pushes and stops advertising the preview when the PR closes. Cloudflare controls retention of old preview URLs. [Cloudflare Pages previews](https://developers.cloudflare.com/pages/configuration/preview-deployments/)
3. **Beta.** Keep Beta deployment configuration under `syntax-beta-domain`. Create the separate Direct Upload project `syntax-beta` and set `SYNTAX_BETA_ORIGIN` to its assigned HTTPS origin. If Beta supports sign-in, give it its own Clerk instance and `VITE_CLERK_BETA_PUBLISHABLE_KEY`. Enable `SYNTAX_BETA_ENABLED` for the rehearsal and subsequent scheduled publishing. The schedule has alternating UTC-day slots, skips an already published commit, and allows a manual run. Beta release tags use a `beta-v` prefix. Stable tags and the default latest release remain independent.

Set `CLOUDFLARE_ACCOUNT_ID` as a Syntax repository variable. Store a Pages-scoped token as `CLOUDFLARE_PAGES_TOKEN` in the `syntax-infra` and `syntax-beta` Actions environments. Use the actual origin Cloudflare assigns if the preferred project name is taken. Cloudflare provides separate HTTPS addresses without a purchased domain. [Cloudflare Direct Upload](https://developers.cloudflare.com/pages/how-to/use-direct-upload-with-continuous-integration/)

The workflow files live under `.github/workflows`. Each deployment must be verified against a commit marker or build checksum before being described as live. The new workflows require a merge to `main` and configured hosting before a real deployment test.

## Documentation and the generated wiki

Write and review the canonical docs alongside the code. Publish one docs site for the current `main` prerelease or Nightly. Show the commit or build it describes. When a PR changes public behavior, update the tutorial, reference, and runnable example that describe it in the same PR. Frequent Nightlies refresh the existing site. Beta can link to the relevant merged guide or a source permalink from its release notes. The latest direction replaces the earlier plan to publish snapshots for supported releases. [Fumadocs static build](https://www.fumadocs.dev/docs/deploying/static) · [Storybook embeds](https://storybook.js.org/docs/sharing/embed)

DeepWiki can help a maintainer or agent navigate the code. The free public T3 Code wiki explains its web, desktop, and server architecture with links to source. Starlight's generated documentation page traces search and configuration to specific files. Obsidian's generated API pages organize lifecycle, commands, and storage around its type declarations. They cover indexed revisions that can differ from the deployed Nightly. The T3 Code wiki showed a three-day wait before the next manual refresh when inspected. Its maintained runbook explains release ordering and which previews can publish. Keep the Syntax walkthroughs and release policy in reviewed PRs so they match the build authors actually use. Use the generated wiki as an optional reference. [Cognition's free public indexing](https://cognition.com/blog/deepwiki) · [T3 Code generated architecture](https://deepwiki.com/pingdotgg/t3code/2-architecture) · [Starlight generated docs](https://deepwiki.com/withastro/starlight/9-showcase-and-examples) · [Obsidian generated API](https://deepwiki.com/obsidianmd/obsidian-api/2-core-architecture)

## Feedback index

Search by topic, ID, or original question number. Add new feedback here with its milestone and source. Amend the existing decision if a later answer changes it, and record the earlier direction under **Superseded decisions**. For implementation PRs, link the feedback ID, exact tested commit, and evidence under the milestone it affects.

### Confirmed decisions

| ID | Feedback | Where it lands |
| --- | --- | --- |
| EXT-01 | Build a general extension system. Prove a tool can add a screen and command, and let extensions work together. Use “extensions” in the product. | V1.1, V1.3 |
| EXT-02 | Fix the install-to-Library gap found in the test course. A real course lives in its own project or official extension package and uses native UI. Keep courses, course data, and subject engines out of core. | V1.2, V1.4 |
| EXT-03 | Disable the extension responsible for a crash and show a clear in-app notification. Recover automatically when startup was interrupted. | V1.1 |
| UI-01 | Launch a live, public Syntax UI library for Syntax courses and tools. Start small, prove quality in a real lesson and a second subject, and grow the component set from use. Allow breaking API changes through beta. Q1–Q2 and the earlier compatibility question. | V1.2 |
| UI-02 | Supply lesson guidelines, tools, and shared components. Let a course supply its own lesson and grading behavior. Q13. | V1.2 |
| UI-03 | Scope ordinary course styles. Reserve app-wide style changes for themes the student enables. Q4. | V1.3 |
| COURSE-01 | Represent required embedded extensions in course code. Recommend standalone tools for extra features useful across courses. List author-recommended tools on course details. Q6, Q8. | V1.3 |
| DATA-01 | Keep course data local while Clerk syncs installs and preferences. Show progress when a course provides it. Preserve it on uninstall and offer per-course deletion at the bottom of Profile. Q14, Q16, Q21. | V1.1, V1.2 |
| DATA-02 | Existing Stable course progress migration is outside the current release requirements. Q10. | V2 scope |
| DOC-01 | Ship **Build a Course** and **Build a Tool** together. Start with a generic course, use live examples, document publishing and installation on Dev, and expose source for agents and the future MCP. Q5, Q17. | V1.4 |
| DOC-02 | Keep docs beside the API. Use Fumadocs for the public site, Storybook for tested examples, and focused repository skills for agents. Deeper instructions and evidence stay in public source outside the site. Q18, Q20. | V1.4 |
| DOC-03 | Publish one rolling main/Nightly docs site. Compare DeepWiki with the reviewed guides. Keep PRs responsible for documentation changes. | V1.4 |
| PUB-01 | Provide Community Hub and direct install links. GitHub hosting details can stay behind the agent workflow. Publish screenshots with listings and lesson assets with packages. Q19. | V1.4 |
| PUB-02 | Automatically install compatible alpha updates as a temporary measure. Leave long-term updater behavior for later and study T3 Code when that work begins. Q9, Q11. | V1.4, later |
| REL-01 | Keep the existing runtime on Stable while Dev adopts the new runtime. Split work into usable V1 milestones and strengthen each before moving on. Q7 and milestone feedback. | All milestones |
| REL-02 | Give PRs isolated Infra previews, give merged changes an on-demand Dev deployment, and keep Nightly prereleases independent. Beta serves students every two days when a build qualifies. Its regular release appears under Syntax even though its site is separate. | V1.1, V1.5 |
| REL-03 | Use CodeRabbit on small public repos with manual triggers below 10 stars. Keep release notes concise and user-facing. | All milestones |

### Earlier product feedback

Use this list when checking regressions and planning separate product work. Verify the current build before marking an older issue open or fixed.

- **Shell and navigation.** Keep Home and Library easy to reach. The mobile tab bar, slider and underline styles, profile dropdown, and hamburger menu need careful review. Settings should replace the top tabs with Settings, Extensions, Courses, and Community Hub. Put **Back to Library** before the main tabs, with space and a smooth transition. Check the active selector on load and the return animation. Keep the dropdown clear of redundant account actions and omit the workspace section from Profile.
- **Library and settings.** Avoid duplicate empty-state shortcuts when the empty state already links to Extensions and Community Hub. Keep the import action useful. Revisit unclear “extension views” wording and weak icons. Check the requested reset controls beside color mode, navigation style, and the Syntax logo destination. Preserve the welcome-back experience the user liked.
- **Mobile and visual quality.** Use the existing visual style as a quality reference. Check contrast and legibility in both themes, strong spacing and hierarchy, polished mobile navigation, and layout at real breakpoints. Keep Syntax's design original. Treat announced deploys and verified live deploys as distinct evidence.
- **Sema and accounts.** Sema remains core. Earlier feedback favored pixel-art exploration and called out the header and idle animations and Sema Studio. Keep that product work separate from the extension MVP. Clerk integration can deepen later. The user declined GitHub OAuth sign-in.
- **Project presentation.** The core README and organization describe Syntax as an extensible learning platform. Keep official course material and the video pipeline with first-party extensions. Keep public repo copy clean, make Nightly prereleases easy to find, and replace generic or overdesigned branding text when touching those pages.

### Superseded decisions

- The earlier archive and worker/iframe designs are useful history. The new Dev runtime targets native extensions. The [existing V1 architecture](ARCHITECTURE.md) remains the reference for the runtime in Stable.
- The public course starter is subject-neutral. MPM2D is a real integration proof and supplied examples of shared UI needs.
- Course progress stays local. The earlier option to sync completion checkmarks through Clerk was replaced in the follow-up answer.
- The first docs site is one rolling main/Nightly site. Per-release public snapshots are outside the current plan.
- The old single V2 alpha bundle became multiple V1 milestones. Continue from the Library and local author preview stay deferred according to the later decisions.

## V2.5 and later

- **V2.5.** Run a local course or tool in Syntax Dev before publishing. Offer **Continue** from the Library when a course can supply the lesson to resume. Q12, Q15.
- **Later updater.** Study T3 Code and plan update timing, version selection, recovery, and state compatibility. The temporary alpha updater is enough for the early milestones.
- **Later MCP authoring system.** Build the larger catalog of runnable mockups, reference courses and tools, screenshots, and focused skills. Plan specialist MCP components after enough real extension authoring work shows what they need. Storybook and the public source provide usable examples in the meantime.
