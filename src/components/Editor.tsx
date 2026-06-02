import { useRef, useEffect } from "react";
import { EditorView, keymap, drawSelection, rectangularSelection } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { foldGutter, indentOnInput, syntaxHighlighting, defaultHighlightStyle, bracketMatching, foldKeymap } from "@codemirror/language";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { highlightSelectionMatches, searchKeymap } from "@codemirror/search";
import { lintKeymap } from "@codemirror/lint";
import { oneDark } from "@codemirror/theme-one-dark";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { rust } from "@codemirror/lang-rust";
import { json } from "@codemirror/lang-json";
import { markdown } from "@codemirror/lang-markdown";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { useStore } from "../store";

function getLangExtension(lang: string) {
  switch (lang) {
    case "rust": return rust();
    case "typescript": case "tsx": return javascript({ typescript: true, jsx: lang === "tsx" });
    case "javascript": case "jsx": return javascript({ jsx: lang === "jsx" });
    case "python": return python();
    case "json": return json();
    case "markdown": return markdown();
    case "html": return html();
    case "css": return css();
    default: return javascript();
  }
}

const extMap: Record<string, string> = {
  rs: "rust", ts: "typescript", tsx: "tsx", js: "javascript", jsx: "jsx",
  py: "python", json: "json", md: "markdown", html: "html", css: "css",
};

export function EditorTabs() {
  const { openTabs, activeTab, closeTab } = useStore();
  return (
    <div className="editor-tabs">
      {openTabs.map((tab) => (
        <div key={tab.path} className={`editor-tab ${activeTab === tab.path ? "active" : ""}`} onClick={() => useStore.setState({ activeTab: tab.path })}>
          <span>{tab.name}</span>
          <span className="editor-tab-close" onClick={(e) => { e.stopPropagation(); closeTab(tab.path); }}>×</span>
        </div>
      ))}
    </div>
  );
}

export function Editor() {
  const editorRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const { openTabs, activeTab } = useStore();
  const tab = openTabs.find((t) => t.path === activeTab);

  useEffect(() => {
    if (!editorRef.current || !tab) return;
    if (viewRef.current) { viewRef.current.destroy(); viewRef.current = null; }

    const lang = extMap[tab.name.split(".").pop() || ""] || "text";

    const state = EditorState.create({
      doc: tab.content || "// Open a file to start editing",
      extensions: [
        history(), foldGutter(), drawSelection(),
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(), syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(), closeBrackets(), rectangularSelection(),
        highlightSelectionMatches(),
        keymap.of([...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap, ...historyKeymap, ...foldKeymap, ...lintKeymap]),
        oneDark, getLangExtension(lang),
      ],
    });

    viewRef.current = new EditorView({ state, parent: editorRef.current });
    return () => { viewRef.current?.destroy(); viewRef.current = null; };
  }, [tab?.path]);

  return <div className="editor-content" ref={editorRef} />;
}
