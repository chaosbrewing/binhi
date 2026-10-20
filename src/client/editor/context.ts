import { createContext, useContext } from "react";
import { EditorStore, useEditorState, type EditorState } from "./store.js";

export const EditorContext = createContext<EditorStore | null>(null);

export function useStore(): EditorStore {
  const s = useContext(EditorContext);
  if (!s) throw new Error("useStore outside EditorContext");
  return s;
}

export function useSel<T>(selector: (s: EditorState) => T): T {
  return useEditorState(useStore(), selector);
}
