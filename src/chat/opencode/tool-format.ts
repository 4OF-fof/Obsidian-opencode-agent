import { JsonRecord, formatDetailValue, normalizePartType, readProperty, readStringProperty, stripAnsi } from "./json";

export function readToolDetailText(value: JsonRecord): string {
  const tool = readStringProperty(value, "tool") || readStringProperty(value, "name");
  const data = readProperty(value, "data");
  const state = readProperty(value, "state");
  const args =
    readProperty(value, "args") ??
    readProperty(value, "arguments") ??
    readProperty(value, "input") ??
    readProperty(data, "args") ??
    readProperty(state, "input");
  const output =
    readProperty(value, "output") ??
    readProperty(data, "output") ??
    readProperty(state, "output");
  const error =
    readProperty(value, "error") ??
    readProperty(data, "error") ??
    readProperty(state, "error");

  if (isReadTool(tool)) {
    return error === undefined ? "" : `エラー\n${formatDetailValue(error)}`;
  }

  return formatToolText(args, output, error);
}

export function toolTitle(tool: string, input: unknown): string {
  if (isReadTool(tool)) {
    return `${pathLabel(readToolPath(input))} を読み取り`;
  }

  const command = readCommand(input);
  if (command || tool === "bash" || tool === "shell") {
    return "コマンドを実行";
  }
  return tool ? `ツール呼び出し: ${tool}` : "ツール呼び出し";
}

function formatToolText(input: unknown, output: unknown, error: unknown): string {
  const parts: string[] = [];

  const command = readCommand(input);
  if (command) {
    parts.push(`コマンドを実行\n${command}`);
  } else if (input !== undefined) {
    parts.push(`入力\n${formatDetailValue(input)}`);
  }

  if (output !== undefined) {
    parts.push(`出力\n${cleanToolOutput(output)}`);
  }

  if (error !== undefined) {
    parts.push(`エラー\n${cleanToolOutput(error)}`);
  }

  return parts.join("\n\n");
}

function readCommand(input: unknown): string {
  return (
    readStringProperty(input, "command") ||
    readStringProperty(input, "cmd") ||
    readStringProperty(input, "description")
  );
}

function readToolPath(input: unknown): string {
  return (
    readStringProperty(input, "filePath") ||
    readStringProperty(input, "path") ||
    readStringProperty(input, "dir") ||
    readStringProperty(input, "directory")
  );
}

function pathLabel(path: string): string {
  if (!path) {
    return "";
  }

  const normalized = path.replace(/\\/g, "/").replace(/\/+$/g, "");
  const workspaceName = "Obsidian";
  const workspaceSuffix = `/${workspaceName}`;
  if (normalized === "." || normalized.endsWith(workspaceSuffix) || normalized === workspaceName) {
    return ".";
  }

  const workspaceSegment = `${workspaceSuffix}/`;
  const workspaceIndex = normalized.indexOf(workspaceSegment);
  if (workspaceIndex >= 0) {
    return normalized.slice(workspaceIndex + workspaceSegment.length) || ".";
  }

  return normalized.split("/").pop() || normalized;
}

function isReadTool(tool: string): boolean {
  return normalizePartType(tool) === "read";
}

function cleanToolOutput(value: unknown): string {
  return stripAnsi(formatDetailValue(value)).trim();
}
