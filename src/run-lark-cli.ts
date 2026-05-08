import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function runLarkCliCommand(args: string[], executableOverride?: string): Promise<string> {
  const candidates = buildLarkCliCandidates(executableOverride);
  let lastError: unknown;

  for (const candidate of candidates) {
    try {
      const { stdout } = await execFileAsync(
        candidate.command,
        [...candidate.prefixArgs, ...args],
        {
          cwd: process.cwd(),
          windowsHide: true,
          maxBuffer: 10 * 1024 * 1024,
        },
      );
      return stdout;
    } catch (error) {
      const errno = (error as NodeJS.ErrnoException).code;
      if (errno === "ENOENT") {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  throw new Error(`No usable lark-cli found. Last error: ${formatErrorMessage(lastError)}`);
}

function buildLarkCliCandidates(executableOverride?: string): Array<{ command: string; prefixArgs: string[] }> {
  const candidates: Array<{ command: string; prefixArgs: string[] }> = [];
  const push = (command: string | undefined, prefixArgs: string[] = []) => {
    if (!command) return;
    candidates.push({ command, prefixArgs });
  };

  push(executableOverride);

  const localScript = resolve(process.cwd(), "node_modules/@larksuite/cli/scripts/run.js");
  if (existsSync(localScript)) {
    push(process.execPath, [localScript]);
  }

  const localBin = resolve(
    process.cwd(),
    "node_modules/.bin",
    process.platform === "win32" ? "lark-cli.cmd" : "lark-cli",
  );
  if (existsSync(localBin)) {
    push(localBin);
  }

  push("lark-cli");
  push(process.platform === "win32" ? "npx.cmd" : "npx", ["lark-cli"]);
  return candidates;
}

function formatErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "unknown");
}

