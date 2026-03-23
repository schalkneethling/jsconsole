# JSConsole

Focused JavaScript REPL for quickly testing browser-style JavaScript snippets without jumping into a full playground or opening DevTools.

Hosted at [jsconsole.schalkneethling.com](https://jsconsole.schalkneethling.com).

## What It Does

JSConsole provides two panes:

- A JavaScript editor powered by CodeMirror 6
- An output pane that mimics common browser console output for `log`, `info`, `warn`, `error`, and final expression results

It is intentionally narrow in scope: write JavaScript, run it quickly, inspect the output, repeat.

## Features

- CodeMirror-based editor with JavaScript syntax highlighting
- Keyboard shortcut to run code with `Ctrl`/`Cmd` + `Enter`
- Browser-style output formatting for logs, warnings, errors, and completion values
- Reset and clear controls
- Accessible resizable splitter between editor and output panes
- Responsive layout that keeps both primary panels usable across viewport sizes

## Accessibility Notes

The editor/output splitter follows the WAI-ARIA Authoring Practices window splitter pattern:

- The splitter uses `role="separator"`
- It exposes `aria-valuemin`, `aria-valuemax`, and `aria-valuenow`
- It references the editor pane as the primary controlled region
- It supports keyboard interaction for resizing and collapse/restore

Reference: [WAI-ARIA APG Window Splitter Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/windowsplitter/)

## Keyboard Shortcuts

### Editor

- `Ctrl`/`Cmd` + `Enter`: Run the current JavaScript

### Splitter

- `Left Arrow`: Decrease editor width
- `Right Arrow`: Increase editor width
- `Home`: Collapse the editor pane
- `End`: Expand to the maximum allowed editor width
- `Enter`: Toggle collapse/restore for the editor pane

## Local Development

### Requirements

- Node.js
- `pnpm`
- Vite+ CLI available via the project scripts

### Install

```bash
pnpm install
```

### Start the dev server

```bash
pnpm dev
```

### Build for production

```bash
pnpm build
```

### Preview the production build

```bash
pnpm preview
```

## Tech Stack

- [Vite+](https://viteplus.dev/)
- [TypeScript](https://www.typescriptlang.org/)
- [CodeMirror 6](https://codemirror.net/)

## Project Structure

```text
.
├── public/
├── src/
│   ├── main.ts
│   └── style.css
├── index.html
├── package.json
└── vite.config.ts
```

## Implementation Notes

- The app is intentionally framework-free and uses TypeScript with direct DOM composition.
- JavaScript execution is scoped to this focused REPL use case and currently emphasizes quick feedback over sandboxing.
- The `Ctrl`/`Cmd` + `Enter` run shortcut uses a CodeMirror keybinding plus a DOM-level fallback due observed key handling precedence behavior. The relevant code includes a link to the upstream CodeMirror discussion.

## Current Limitations

- This is not a secure sandbox and should be treated as a trusted local tool/app experience.
- Console rendering is intentionally simplified and does not try to exactly replicate every browser DevTools feature.
- The production build currently emits a chunk-size warning because the app ships CodeMirror in a single bundle.

## License

No license has been added yet.
