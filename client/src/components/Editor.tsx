import { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';

interface EditorProps {
  onTextChange: (text: string) => void;
  initialValue?: string;
  /** Monaco editor theme name: 'vs-dark' | 'vs' | 'hc-black' */
  monacoTheme?: string;
}

/**
 * Monaco Editor wrapper component.
 * Stores the editor value in a ref (not state) to avoid re-render storms
 * on every keystroke. Debounces translation calls by 500ms.
 */
export function Editor({ onTextChange, initialValue = '', monacoTheme = 'vs-dark' }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    editorRef.current = monaco.editor.create(containerRef.current, {
      value: initialValue,
      language: 'plaintext',
      theme: monacoTheme,
      wordWrap: 'on',
      minimap: { enabled: false },
      fontSize: 16,
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      automaticLayout: true,
    });

    editorRef.current.onDidChangeModelContent(() => {
      const text = editorRef.current?.getValue() ?? '';

      // Debounce: only notify after 500ms of inactivity
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        onTextChange(text);
      }, 500);
    });

    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      editorRef.current?.dispose();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply theme changes without recreating the editor
  useEffect(() => {
    monaco.editor.setTheme(monacoTheme);
  }, [monacoTheme]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', minHeight: '400px' }}
    />
  );
}
