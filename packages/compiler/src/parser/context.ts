import { CompileDiagnostic } from "../types.ts";

export type ParserContext = {
  lineIndex: number;
  sourceLines: string[];
  diagnostics: CompileDiagnostic[];
};
