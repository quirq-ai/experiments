"use client";

import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { python } from "@codemirror/lang-python";
import { oneDark } from "@codemirror/theme-one-dark";

interface EditorProps {
  code: string;
  language: string;
  onChange: (value: string) => void;
}

export default function Editor({ code, language, onChange }: EditorProps) {
  const extensions = language === "python" ? [python()] : [javascript()];

  return (
    <CodeMirror
      value={code}
      height="350px"
      theme={oneDark}
      extensions={extensions}
      onChange={onChange}
      basicSetup={{
        lineNumbers: true,
        highlightActiveLine: true,
        bracketMatching: true,
        closeBrackets: true,
        autocompletion: true,
        foldGutter: true,
        indentOnInput: true,
      }}
    />
  );
}
