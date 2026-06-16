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

  if (isQuestionTool(tool)) {
    return formatQuestionToolText(
      output ??
      readProperty(value, "result") ??
      readProperty(data, "result") ??
      readProperty(state, "result"),
    );
  }

  if (isReadTool(tool)) {
    return error === undefined ? "" : `エラー\n${formatDetailValue(error)}`;
  }

  return formatToolText(args, output, error);
}

export function toolTitle(tool: string, input: unknown): string {
  if (isQuestionTool(tool)) {
    return "質問への回答";
  }

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

function formatQuestionToolText(value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }

  const parsed = parseMaybeJson(value);
  if (typeof parsed === "string") {
    return formatQuestionAnswerMessage(parsed);
  }

  const answers = readProperty(parsed, "answers") ?? parsed;
  if (Array.isArray(answers)) {
    return answers
      .map((answer, index) => {
        const values = Array.isArray(answer) ? answer : [answer];
        return `質問 ${index + 1}\n${values.map(String).join(", ")}`;
      })
      .join("\n\n");
  }

  return cleanToolOutput(parsed);
}

function formatQuestionAnswerMessage(value: string): string {
  const matches = [...value.matchAll(/"([^"]+)"="([^"]*)"/g)];
  if (matches.length === 0) {
    return stripQuestionContinueText(value).trim();
  }

  return matches
    .map((match) => `${match[1]}\n${match[2]}`)
    .join("\n\n");
}

function stripQuestionContinueText(value: string): string {
  return value
    .replace(/^User has answered your questions:\s*/i, "")
    .replace(/You can now continue with the user's answers in mind\.?/i, "");
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
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

export function isQuestionTool(tool: string): boolean {
  const normalized = normalizePartType(tool);
  return normalized === "question" || normalized === "questiontool" || normalized === "requestuserinput";
}

function cleanToolOutput(value: unknown): string {
  return stripAnsi(formatDetailValue(value)).trim();
}
