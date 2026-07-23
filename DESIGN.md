# UI design guardrails

This document defines the stable product experience. The executable sources of
truth are `src/styles/tokens.css` for visual foundations and
`src/components/ui.tsx` for shared primitives. Do not reproduce a component
catalog or pixel specification here.

## Experience principles

- Keep the interface calm, direct, and reassuring. Zadiag supports a routine;
  it must not look diagnostic, punitive, or clinically authoritative.
- Give each screen one obvious primary action. Secondary actions must not
  compete through size, color, or placement.
- Present the same routine, status, and participant consistently across roles.
  Shared presentation belongs in domain presenters or shared components.
- Prefer progressive disclosure over dense dashboards. Show operational detail
  only when it helps the current decision.
- Use plain bilingual language. A visual state must never rely on color alone.

## Visual system

- Use semantic values from `src/styles/tokens.css`. Components and screens must
  not introduce raw colors or redefine foundational tokens.
- Existing contextual literals in `app.css` are tracked as migration debt by
  `check:design`: their occurrence and distinct-value ceilings may only fall,
  and a literal must disappear as soon as a semantic token covers it.
- Dynamic routine and profile colors enter the UI through documented custom
  properties such as `--routine-accent` and `--profile-color`.
- Reuse an existing primitive before adding a new component or variant. Extract
  a new primitive only for multiple real consumers or a shared invariant.
- Keep layout values local when they describe a unique composition. Promote a
  value to a token only when it expresses a repeated design decision.
- Inline styles are reserved for runtime values and must be passed through CSS
  custom properties. Static presentation belongs in stylesheets.

## Required states

Every interactive flow must account for the states that can occur at runtime:

- loading or pending work;
- successful completion;
- empty content with a useful next action;
- recoverable error;
- disabled or unavailable action;
- stale, expired, or offline data when relevant.

Do not create a second component tree for a state when the same structure can
express it with content and state classes.

## Shared interaction model

- The same action or state must keep the same label hierarchy, control treatment,
  and feedback pattern across screens. Centralize shared presentation in a
  domain presenter or existing UI primitive instead of synchronizing copies.
- A control variant must express a recurring semantic role such as primary,
  secondary, or destructive. Do not add a variant to solve one screen's spacing
  or color.
- Loading disables the initiating action, preserves its label or purpose, and
  exposes progress without moving the primary action. Recoverable failure keeps
  the user's input and presents the next useful action.
- Disabled and unavailable are different states: disabled explains a temporary
  constraint; unavailable does not render an action that cannot succeed.
- Routine and profile accents provide context, not meaning. Selection, status,
  validation, and error feedback must remain understandable without the accent
  color.

## Accessibility and interaction

- All actions must remain keyboard reachable and expose a visible focus state.
- Icon-only actions require an accessible name. Status meaning requires text,
  not only an icon or color.
- Preserve readable contrast and browser text scaling. Do not lock font sizes
  or containers in ways that clip translated content.
- Respect reduced-motion preferences. Animation communicates continuity; it
  must not be required to understand a state change.
- Validate touch interactions on the supported mobile widths and keep primary
  controls comfortably tappable.

## Responsive review

Review UI changes at narrow and wide phone widths first, then tablet/desktop
where the screen supports them. Verify long French labels, keyboard focus,
empty content, error content, disabled or pending actions, and at least one
populated state. Compare every changed shared component in each real consumer,
not only in the screen that motivated the change. Use a remote preview only
when device APIs or real PWA behavior require it.

Run `pnpm check:design` while changing shared presentation and `pnpm check`
before delivery. A deliberate change to these invariants must update this file,
the executable source of truth, and its guardrail in one coherent batch.
