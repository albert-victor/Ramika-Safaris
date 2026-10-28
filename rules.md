# Cursor Project Rules – Website Quality, Consistency & Efficient Delivery

> **Purpose:** Use these rules throughout this project, from the first inspection to final verification. Build a distinctive, reliable website without unnecessary complexity, repeated work, wasted tokens, or unintended changes.
>
> **Priority:** Follow the user's latest explicit request, these project rules, and the existing project constraints. If instructions conflict or an important decision is unclear, identify the conflict and ask one focused question instead of guessing.

## Locked decision: brand name

The company name is **Ramika Safaris and Tours** (or **Ramika Safaris and Tours Limited** when the legal entity is meant). Always use the full name in copy, headlines, titles, CTAs, alt text, and aria labels. Do not shorten to “Ramika” alone or “Ramika Safaris”.

## Locked decision: typography

No signature or script display fonts. Do not use Midnight Signature, Yellowtail, Allura, Qwitcher Grypen, or any cursive / handwritten face.

- Titles: Barlow Condensed, forest green (`#0D6235`).
- Body, navigation, interface text, and subtitle accents (`.script` / `.tag-script`): **Nunito** (rounded), weight 500+. Subtitles stay smaller than the title, keep yellow (`#FCAE0B`) contrast, and keep the existing swash underline decoration. Do not rotate or italicize them to mimic a signature.
- Primary body `#555B57`. Secondary / metadata `#747A75`. Do not use pure black for ordinary text. Do not use green for long descriptions.
- Punctuation: Never use an em dash (`—`). Always use an en dash (`–`) for breaks, asides, and ranges in copy, UI text, comments, and documentation. Use an em dash only when it is genuinely necessary and no en dash alternative works.

Section-header groups (kicker + subtitle + heading, and a short associated intro paragraph) are centered. Long-form body, cards, packages, nav, and forms keep their existing alignment.

Colour tokens also include logo yellow `#FCAE0B` and white. The page sits on warm paper. Bootstrap and Font Awesome are loaded from CDNs. Shared chrome lives in `partials/`. Primary nav: Home, Destinations (circuit mega menu), Activities (compact mega menu), Safaris (`packages.html`), About, Contact, plus a Book now CTA. Circuit pages use `circuit.html?slug=…`; activity pages use `activity.html?slug=…` and `activities.html`. Buttons are `.btn-ghost` and `.btn-outline` only.

## 1. Core working principles

- Understand the project before editing files. Do not assume the business, audience, pages, content, technology, or visual direction until the user or project files establish them.
- Be creative, but make deliberate decisions. Avoid generic AI-template output, decorative clutter, and design choices that have no clear purpose.
- Prefer the simplest maintainable solution that fully meets the requirement.
- Preserve working functionality and existing project conventions unless a change is necessary or explicitly requested.
- Do not rewrite, redesign, refactor, or replace unrelated parts of the project just because they could be improved.
- Do not claim that something was tested, visually checked, fixed, or completed unless you actually verified it.
- If information is missing, use a safe, reversible assumption only when it has low impact. Clearly state important assumptions; ask before making high-impact or irreversible decisions.

## 2. Start of project: inspect and plan efficiently

Before implementation:

1. Inspect the project structure, package scripts, framework, routing, styling approach, existing components, project instructions, and relevant documentation.
2. Identify what already works and what must be built. Avoid reading every file when a targeted inspection is enough.
3. Check for existing design tokens, shared components, fonts, image assets, and patterns before creating new ones.
4. Summarize the proposed approach briefly, including major assumptions and any blocking questions.
5. Establish a coherent visual and content direction before building many pages.

Do not perform a large implementation before understanding the basic requirements. Do not spend time producing long plans for simple, clearly specified tasks.

## 3. Design direction and visual quality

Create a website that feels intentional and appropriate to its actual brand, audience, and purpose – not like a generic template.

- Use references to understand specific principles such as layout, hierarchy, typography, image treatment, spacing, or interaction. Do not blindly copy a reference or assume that a screenshot explains its design logic.
- Make clear choices about visual hierarchy, composition, typography, colour, spacing, imagery, and calls to action.
- Prefer a few strong, coherent design decisions over excessive decoration.
- Avoid adding sections, badges, gradients, shadows, rounded containers, animations, or effects without a clear user or brand benefit.
- Ensure visual elements support the content rather than compete with it.
- Do not make every page look identical. Different pages can have different layouts, but they must share the same underlying design language.

## 4. Design system and consistency

Create or follow a lightweight, reusable design system appropriate to the project's size.

- Centralize shared values where practical: colours, typography scale, spacing, content widths, radii, shadows, breakpoints, and component states.
- Reuse existing components and tokens when suitable. Do not create duplicate versions of the same component without a genuine need.
- Keep buttons, forms, navigation, cards, headings, links, and other recurring elements consistent.
- Define clear variants for components that genuinely need different roles, such as primary and secondary buttons or package and destination cards.
- Keep spacing, alignment, image ratios, card padding, and typography hierarchy deliberate and predictable.
- Use semantic, component-scoped styling where practical. Avoid broad CSS selectors or global changes that unintentionally affect unrelated pages.
- Do not introduce a new colour, font, radius, shadow, spacing value, or interaction pattern without checking whether an existing system value should be reused.
- When a shared design decision changes, check its impact across the components and pages that use it.

Consistency means a shared design language, not forcing every section or page into the same layout.

## 5. Typography, contrast, spacing, and readability

- Establish a clear hierarchy for page titles, section headings, body text, metadata, labels, and buttons.
- Use a restrained, intentional type system. Typography should suit the brand; avoid both generic default styling and unnecessary font variety.
- Maintain readable font sizes, line heights, line lengths, and paragraph widths.
- Check text contrast against its actual background, including text over images and hover/focus states.
- Use whitespace to group related information and separate different ideas. Avoid both cramped layouts and empty space with no purpose.
- Align related elements consistently and ensure responsive layouts do not create awkward gaps, clipping, or overlap.
- Follow accessibility best practices, including visible focus states, semantic headings, labelled form controls, keyboard usability, and reduced-motion preferences where relevant.

## 6. Cards, buttons, images, and recurring components

- Give every component a clear purpose and content hierarchy.
- Keep recurring card structures consistent in image treatment, spacing, typography, metadata, and action placement unless a deliberate variant is needed.
- Use button styles consistently. The visual weight of each button should match its importance.
- Use meaningful, action-specific CTA text rather than repeating generic labels everywhere.
- Preserve image aspect ratios and use intentional cropping and focal points. Avoid stretching images or selecting imagery that does not match the content.
- Use available project assets and established image conventions before introducing new assets or dependencies.
- Ensure components have appropriate loading, empty, error, hover, focus, and disabled states when applicable.
- Do not add components solely to fill space or make a page look busier.

## 7. Copywriting and content architecture

Write natural, specific, useful copy that fits the actual page, audience, and brand voice.

- Avoid placeholder-style wording, generic marketing claims, repetitive sentence structures, and overused phrases that could describe any company.
- Do not invent company credentials, awards, certifications, statistics, guarantees, reviews, prices, or other factual claims.
- Give every page and section a clear purpose. The homepage, about page, destination page, product/package page, and contact page should not repeat the same message without a reason.
- Repeat information only when it improves navigation, trust, usability, conversion, or legal clarity.
- Keep persistent items such as contact details, navigation, and required notices consistent.
- Make headings informative and distinct. Every paragraph should explain something, answer a question, establish relevant trust, or help the user take the next step.
- Keep copy concise where possible, but do not remove details users need to make a decision.
- Use the project's established spelling, language, terminology, and tone consistently.
- If source information is missing, use clearly identified neutral wording or ask for the missing fact. Never fabricate specifics to make copy sound more persuasive.

## 8. Scope control: change only what is needed

This is a critical rule.

- Before editing, identify the exact requested outcome and the smallest reasonable set of files and components that can achieve it.
- Make focused, minimal changes. Do not silently expand the task into a redesign, refactor, dependency change, or content rewrite.
- Preserve unrelated layouts, styles, data, routes, functionality, and user-approved decisions.
- Before changing a shared component, global style, token, route, dependency, or configuration, check what else depends on it.
- If a local change can solve the problem safely, prefer it over a global change.
- If a shared change is necessary, explain its expected impact briefly and verify affected areas.
- Do not solve a visual problem by changing unrelated typography, colours, spacing, or components unless the relationship is real and necessary.
- Avoid replacing whole files when a small, targeted edit is sufficient.
- Do not undo the user's intentional changes or discard work that is not part of the current task.

## 9. Prevent regressions and accidental side effects

After each meaningful change:

- Check that the requested issue is addressed.
- Check nearby elements and any shared components likely to be affected.
- Preserve existing functionality, links, routes, forms, validation, and responsive behaviour.
- Run relevant checks already available in the project, such as linting, type checks, tests, build checks, or targeted browser inspection.
- Fix errors introduced by the current change. Do not hide failures or claim success if verification could not be completed.
- If a check fails for an unrelated pre-existing reason, report that distinction clearly.
- Prefer small, understandable edits that are easy to review and reverse.
- Do not make a chain of speculative changes without inspecting the result after each important step.

## 10. Responsive design and performance

- Treat mobile, tablet, and desktop as intentional layouts, not just a desktop page squeezed into a smaller screen.
- Check navigation, grids, cards, images, forms, headings, spacing, and CTA placement at relevant widths.
- Avoid horizontal overflow, clipped content, overlapping elements, and controls that are difficult to use on touch screens.
- Prioritize fast loading and a smooth experience, especially on mobile and lower-powered devices.
- Optimize images and avoid unnecessarily large assets, heavy animation, excessive JavaScript, duplicate libraries, and dependencies that do not provide meaningful value.
- Prefer native platform capabilities and existing project tools when they are sufficient.
- Do not sacrifice usability, accessibility, or maintainability for visual effects.

## 11. Efficient token and time usage

Work efficiently without sacrificing correctness.

- Inspect only the files and context relevant to the current task; expand the investigation when evidence requires it.
- Reuse project knowledge, components, tokens, and verified decisions rather than rediscovering or rebuilding them.
- Avoid repeatedly printing or summarizing large files when a focused excerpt or targeted search is enough.
- Do not re-explain the entire project in every response. Report only decisions, changes, risks, and next steps relevant to the task.
- Avoid speculative alternatives, excessive planning, unnecessary abstractions, and repeated full rewrites.
- Batch closely related inspections or changes when this reduces overhead and remains safe.
- Do not run expensive or broad checks unnecessarily; use targeted checks for small changes and broader checks before major milestones or release.
- Never optimize token usage by skipping essential verification, ignoring errors, or making unsupported assumptions.
- If the user changes direction, confirm which prior decisions remain valid before redoing large amounts of work.

## 12. Working with references and feedback

- Translate feedback into specific design or implementation changes before editing.
- When the user provides a reference or screenshot, identify which aspects matter and which should remain different.
- Do not assume “make it modern,” “make it premium,” or “improve it” means adding more effects. Improve hierarchy, composition, typography, spacing, content, and usability first.
- When the user rejects a result, identify the likely underlying cause and address it rather than applying random cosmetic changes.
- If feedback could reasonably mean several different things and the choice would materially change the result, ask one concise clarification. Otherwise make a small, reversible improvement.
- Keep previously approved design decisions unless the new feedback explicitly changes them.

## 13. Browser and visual verification

When browser or preview tools are available, inspect the actual rendered website after significant UI work.

Check at least:
- The page at desktop and mobile widths.
- Typography, contrast, spacing, alignment, and image cropping.
- Repeated components and consistency across relevant pages.
- Navigation, links, buttons, and forms.
- Console errors and obvious runtime issues.
- Loading and empty states where relevant.

Compare the result with the requested design direction, not merely with whether the page renders. Fix verified issues, then recheck the affected area.

If browser inspection is unavailable, state what was verified through code and what still needs a visual check. Never pretend to have seen a rendered result when you have not.

## 14. Dependencies, security, and project integrity

- Do not add, remove, or upgrade dependencies unless the task requires it and the benefit justifies the cost and risk.
- Do not expose secrets, credentials, API keys, or private configuration in source code or logs.
- Follow existing environment-variable and configuration practices.
- Avoid destructive commands, overwriting user work, deleting assets, changing database structures, or resetting project state without explicit authorization.
- Preserve existing project conventions and compatibility unless there is a clear reason to change them.
- Flag consequential risks before making irreversible changes.

## 15. Definition of done

A task is complete only when the requested outcome is implemented and the relevant checks have been performed.

Before reporting completion, confirm:
- The requested change is present.
- Unrelated approved work has been preserved.
- Shared components and nearby pages have not been unintentionally damaged.
- Visual consistency, readability, and responsive behaviour remain acceptable for the scope of the change.
- Relevant tests or checks have been run where available.
- Any unverified behaviour, blockers, assumptions, or known issues are stated honestly.

Keep the final update concise: summarize what changed, which checks were performed, and anything that still needs attention.

---

## Default decision rule

**Understand first. Reuse before rebuilding. Make the smallest safe change. Keep the design intentional. Verify before claiming completion.**

These rules guide decisions throughout the project; they do not replace the user's requirements or the need to understand the specific website being built.
