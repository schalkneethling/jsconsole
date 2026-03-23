import "./style.css";
import { basicSetup, EditorView } from "codemirror";
import { Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { javascript } from "@codemirror/lang-javascript";
import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
import { tags } from "@lezer/highlight";

type ConsoleKind = "log" | "info" | "warn" | "error" | "result";

type ConsoleEntry = {
  kind: ConsoleKind;
  values: string[];
};

const SPLITTER_DEFAULT = 58;
const SPLITTER_MIN = 0;
const SPLITTER_MAX = 100;
const SPLITTER_STEP = 2;
const SPLITTER_COLLAPSED = 0;
const SPLITTER_MIN_PRIMARY_PX = 320;
const SPLITTER_MIN_SECONDARY_PX = 320;

const initialCode = `const inventory = [
  { label: "Adapters", stock: 8 },
  { label: "Cables", stock: 13 },
  { label: "Switches", stock: 5 },
];

console.log("Inventory loaded");

const totalStock = inventory.reduce((sum, item) => sum + item.stock, 0);
const lowStock = inventory.filter((item) => item.stock < 6);

console.table?.(inventory);
console.warn("Low stock items:", lowStock.map((item) => item.label));

totalStock;`;

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Unable to mount app");
}

app.innerHTML = `
  <main class="shell">
    <header class="masthead">
      <h1>JSConsole <span>focused JavaScript REPL</span></h1>
      <p class="intro">
        Write JavaScript on the left, run it with <kbd>Ctrl</kbd>/<kbd>Cmd</kbd> + <kbd>Enter</kbd>,
        and inspect browser-style output on the right.
      </p>
    </header>

    <section class="workspace" aria-label="JavaScript console workspace">
      <section class="panel editor-panel" id="editor-panel" aria-labelledby="editor-title">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">Editor</p>
            <h2 id="editor-title">Live scratchpad</h2>
          </div>
          <div class="actions">
            <button class="ghost-button" id="reset-button" type="button">Reset sample</button>
            <button class="primary-button" id="run-button" type="button">Run code</button>
          </div>
        </div>
        <div id="editor" class="editor-host" aria-label="JavaScript editor"></div>
      </section>

      <div
        id="workspace-splitter"
        class="splitter"
        role="separator"
        tabindex="0"
        aria-orientation="vertical"
        aria-labelledby="editor-title"
        aria-controls="editor-panel"
        aria-valuemin="0"
        aria-valuemax="100"
        aria-valuenow="58"
      >
        <span class="splitter-handle" aria-hidden="true"></span>
      </div>

      <section class="panel console-panel" id="console-panel" aria-labelledby="console-title">
        <div class="panel-header">
          <div>
            <p class="panel-kicker">Output</p>
            <h2 id="console-title">Browser-style console</h2>
          </div>
          <button class="ghost-button" id="clear-button" type="button">Clear</button>
        </div>
        <div id="console-output" class="console-output" role="log" aria-live="polite"></div>
      </section>
    </section>
  </main>
`;

const consoleOutputNode = document.querySelector<HTMLDivElement>("#console-output");
const runButtonNode = document.querySelector<HTMLButtonElement>("#run-button");
const clearButtonNode = document.querySelector<HTMLButtonElement>("#clear-button");
const resetButtonNode = document.querySelector<HTMLButtonElement>("#reset-button");
const editorHostNode = document.querySelector<HTMLDivElement>("#editor");
const workspaceNode = document.querySelector<HTMLElement>(".workspace");
const splitterNode = document.querySelector<HTMLDivElement>("#workspace-splitter");

if (
  !consoleOutputNode ||
  !runButtonNode ||
  !clearButtonNode ||
  !resetButtonNode ||
  !editorHostNode ||
  !workspaceNode ||
  !splitterNode
) {
  throw new Error("Unable to initialize controls");
}

const consoleOutput = consoleOutputNode;
const runButton = runButtonNode;
const clearButton = clearButtonNode;
const resetButton = resetButtonNode;
const editorHost = editorHostNode;
const workspace = workspaceNode;
const splitter = splitterNode;

const customTheme = EditorView.theme({
  "&": {
    height: "100%",
    color: "var(--editor-text)",
    backgroundColor: "transparent",
    fontFamily: "var(--mono)",
    fontSize: "15px",
  },
  ".cm-scroller": {
    overflow: "auto",
    lineHeight: "1.6",
    padding: "1rem 0",
  },
  ".cm-content": {
    caretColor: "var(--accent-strong)",
    padding: "0 1rem 1.5rem",
  },
  ".cm-gutters": {
    backgroundColor: "transparent",
    color: "var(--gutter)",
    border: "none",
    paddingRight: "0.5rem",
  },
  ".cm-activeLine": {
    backgroundColor: "rgba(248, 197, 72, 0.08)",
  },
  ".cm-activeLineGutter": {
    backgroundColor: "transparent",
  },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(234, 90, 36, 0.35)",
  },
  "&.cm-focused .cm-cursor": {
    borderLeftColor: "var(--accent-strong)",
  },
});

const customHighlightStyle = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier], color: "var(--syntax-keyword)", fontWeight: "700" },
  { tag: [tags.name, tags.deleted, tags.character, tags.propertyName, tags.macroName], color: "var(--syntax-property)" },
  { tag: [tags.variableName], color: "var(--syntax-variable)" },
  { tag: [tags.function(tags.variableName), tags.labelName], color: "var(--syntax-function)" },
  { tag: [tags.color, tags.constant(tags.name), tags.standard(tags.name)], color: "var(--syntax-constant)" },
  { tag: [tags.definition(tags.name), tags.separator], color: "var(--editor-text)" },
  { tag: [tags.brace, tags.squareBracket, tags.paren, tags.punctuation], color: "var(--syntax-punctuation)" },
  { tag: [tags.number, tags.bool, tags.null], color: "var(--syntax-number)" },
  { tag: [tags.string, tags.special(tags.string)], color: "var(--syntax-string)" },
  { tag: [tags.comment], color: "var(--syntax-comment)", fontStyle: "italic" },
  { tag: [tags.operator, tags.operatorKeyword], color: "var(--syntax-operator)" },
]);

// Keep this binding at the highest precedence per https://discuss.codemirror.net/t/why-is-the-enter-key-not-capture-in-codemirror-6/9048
const runShortcutExtension = Prec.highest(
  keymap.of([
    {
      key: "Mod-Enter",
      run: () => {
        void executeCode();
        return true;
      },
    },
  ]),
);

const runShortcutFallback = EditorView.domEventHandlers({
  keydown: (domEvent) => {
    if ((domEvent.metaKey || domEvent.ctrlKey) && domEvent.key === "Enter") {
      domEvent.preventDefault();
      void executeCode();
      return true;
    }

    return false;
  },
});

const editor = new EditorView({
  doc: initialCode,
  extensions: [
    basicSetup,
    javascript(),
    customTheme,
    syntaxHighlighting(customHighlightStyle),
    runShortcutExtension,
    runShortcutFallback,
  ],
  parent: editorHost,
});

const AsyncFunction = async function () {}.constructor as new (
  ...args: string[]
) => (consoleObject: Console, source: string) => Promise<unknown>;

let splitValue = SPLITTER_DEFAULT;
let previousExpandedSplitValue = SPLITTER_DEFAULT;

function updateSplitter(value: number) {
  splitValue = Math.min(SPLITTER_MAX, Math.max(SPLITTER_MIN, value));

  if (splitValue > SPLITTER_COLLAPSED) {
    previousExpandedSplitValue = splitValue;
  }

  workspace.style.setProperty("--split-primary", `${splitValue}%`);
  splitter.setAttribute("aria-valuenow", String(Math.round(splitValue)));
  splitter.setAttribute("aria-valuetext", `${Math.round(splitValue)} percent`);
  workspace.dataset.collapsed = String(splitValue === SPLITTER_COLLAPSED);
}

function clampSplitValue(nextValue: number, { allowCollapse = false } = {}) {
  const workspaceWidth = workspace.clientWidth;
  const splitterWidth = splitter.getBoundingClientRect().width || 14;
  const minPrimaryPercent = (SPLITTER_MIN_PRIMARY_PX / workspaceWidth) * 100;
  const minSecondaryPercent = (SPLITTER_MIN_SECONDARY_PX / workspaceWidth) * 100;
  const minAllowed = allowCollapse ? SPLITTER_COLLAPSED : minPrimaryPercent;
  const maxAllowed = 100 - minSecondaryPercent - (splitterWidth / workspaceWidth) * 100;

  if (workspaceWidth <= SPLITTER_MIN_PRIMARY_PX + SPLITTER_MIN_SECONDARY_PX + splitterWidth) {
    return Math.min(SPLITTER_MAX, Math.max(SPLITTER_MIN, nextValue));
  }

  return Math.min(maxAllowed, Math.max(minAllowed, nextValue));
}

function getSplitValueFromPointer(clientX: number) {
  const rect = workspace.getBoundingClientRect();
  const splitterWidth = splitter.getBoundingClientRect().width || 14;
  const availableWidth = rect.width - splitterWidth;
  const rawValue = ((clientX - rect.left - splitterWidth / 2) / availableWidth) * 100;

  return clampSplitValue(rawValue);
}

function toggleSplitterCollapse() {
  if (splitValue === SPLITTER_COLLAPSED) {
    updateSplitter(clampSplitValue(previousExpandedSplitValue || SPLITTER_DEFAULT));
    return;
  }

  previousExpandedSplitValue = splitValue;
  updateSplitter(SPLITTER_COLLAPSED);
}

function renderPlaceholder() {
  consoleOutput.innerHTML = `
    <div class="console-empty">
      <p class="console-empty-title">Console standing by</p>
      <p>Run your snippet to inspect logs, warnings, thrown errors, and the final completion value.</p>
    </div>
  `;
}

function formatValue(value: unknown, depth = 0): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "function") {
    return `[Function ${value.name || "anonymous"}]`;
  }
  if (value instanceof Error) {
    return `${value.name}: ${value.message}`;
  }
  if (Array.isArray(value)) {
    if (depth > 1) return `[Array(${value.length})]`;
    return `[${value.map((item) => formatValue(item, depth + 1)).join(", ")}]`;
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (value instanceof Map) {
    return `Map(${value.size}) ${formatValue(Object.fromEntries(value), depth + 1)}`;
  }
  if (value instanceof Set) {
    return `Set(${value.size}) ${formatValue([...value], depth + 1)}`;
  }
  if (typeof value === "object") {
    if (depth > 1) return "{…}";

    const entries = Object.entries(value as Record<string, unknown>)
      .slice(0, 8)
      .map(([key, item]) => `${key}: ${formatValue(item, depth + 1)}`);

    return `{ ${entries.join(", ")} }`;
  }

  return String(value);
}

function appendEntry(entry: ConsoleEntry) {
  const row = document.createElement("div");
  row.className = `console-line console-line-${entry.kind}`;

  const badge = document.createElement("span");
  badge.className = "console-badge";
  badge.textContent = entry.kind;

  const content = document.createElement("pre");
  content.className = "console-content";
  content.textContent = entry.values.join(" ");

  row.append(badge, content);
  consoleOutput.append(row);
  consoleOutput.scrollTop = consoleOutput.scrollHeight;
}

function createConsoleProxy(push: (entry: ConsoleEntry) => void): Console {
  return {
    log: (...values: unknown[]) => {
      push({ kind: "log", values: values.map((value) => formatValue(value)) });
    },
    info: (...values: unknown[]) => {
      push({ kind: "info", values: values.map((value) => formatValue(value)) });
    },
    warn: (...values: unknown[]) => {
      push({ kind: "warn", values: values.map((value) => formatValue(value)) });
    },
    error: (...values: unknown[]) => {
      push({ kind: "error", values: values.map((value) => formatValue(value)) });
    },
    table: (value: unknown) => {
      push({ kind: "log", values: [formatValue(value)] });
    },
    clear: () => {
      consoleOutput.innerHTML = "";
    },
  } as Console;
}

async function executeCode() {
  const source = editor.state.doc.toString();
  const entries: ConsoleEntry[] = [];
  const runner = new AsyncFunction(
    "console",
    "source",
    `
      return await (async () => eval(source))();
    `,
  );

  consoleOutput.innerHTML = "";

  try {
    const result = await runner(createConsoleProxy((entry) => entries.push(entry)), source);
    entries.forEach(appendEntry);

    if (result !== undefined) {
      appendEntry({ kind: "result", values: [formatValue(result)] });
    }
  } catch (error) {
    entries.forEach(appendEntry);
    appendEntry({
      kind: "error",
      values: [formatValue(error instanceof Error ? error : new Error(String(error)))],
    });
  }
}

runButton.addEventListener("click", () => {
  void executeCode();
});

clearButton.addEventListener("click", renderPlaceholder);

resetButton.addEventListener("click", () => {
  editor.dispatch({
    changes: {
      from: 0,
      to: editor.state.doc.length,
      insert: initialCode,
    },
  });
});

splitter.addEventListener("pointerdown", (event) => {
  if (window.matchMedia("(max-width: 980px)").matches) {
    return;
  }

  event.preventDefault();
  splitter.focus();
  splitter.setPointerCapture(event.pointerId);

  const moveSplitter = (moveEvent: PointerEvent) => {
    updateSplitter(getSplitValueFromPointer(moveEvent.clientX));
  };

  const stopDragging = () => {
    splitter.removeEventListener("pointermove", moveSplitter);
    splitter.removeEventListener("pointerup", stopDragging);
    splitter.removeEventListener("pointercancel", stopDragging);
  };

  splitter.addEventListener("pointermove", moveSplitter);
  splitter.addEventListener("pointerup", stopDragging);
  splitter.addEventListener("pointercancel", stopDragging);
});

splitter.addEventListener("keydown", (event) => {
  switch (event.key) {
    case "ArrowLeft":
      event.preventDefault();
      updateSplitter(clampSplitValue(splitValue - SPLITTER_STEP));
      break;
    case "ArrowRight":
      event.preventDefault();
      updateSplitter(clampSplitValue(splitValue + SPLITTER_STEP));
      break;
    case "Home":
      event.preventDefault();
      updateSplitter(SPLITTER_COLLAPSED);
      break;
    case "End":
      event.preventDefault();
      updateSplitter(clampSplitValue(SPLITTER_MAX));
      break;
    case "Enter":
      event.preventDefault();
      toggleSplitterCollapse();
      break;
    default:
      break;
  }
});

window.addEventListener("resize", () => {
  if (window.matchMedia("(max-width: 980px)").matches) {
    updateSplitter(SPLITTER_DEFAULT);
    return;
  }

  updateSplitter(clampSplitValue(splitValue, { allowCollapse: splitValue === SPLITTER_COLLAPSED }));
});

updateSplitter(SPLITTER_DEFAULT);
renderPlaceholder();
