import { compile, type CompileResult } from "@workspace/compiler";

type CompileRequest = {
  id: number;
  source: string;
};

type CompileResponse =
  | {
      id: number;
      ok: true;
      patch: NonNullable<CompileResult["patch"]>;
      diagnostics: CompileResult["diagnostics"];
    }
  | {
      id: number;
      ok: false;
      diagnostics: CompileResult["diagnostics"];
    };

const workerScope =
  typeof self !== "undefined" && "postMessage" in self ? self : undefined;

if (workerScope) {
  workerScope.onmessage = (event: MessageEvent<CompileRequest>) => {
    const { id, source } = event.data;
    const result = compile(source);

    const response: CompileResponse = result.ok
      ? {
          id,
          ok: true,
          patch: result.patch!,
          diagnostics: result.diagnostics,
        }
      : {
          id,
          ok: false,
          diagnostics: result.diagnostics,
        };

    workerScope.postMessage(response);
  };
}
