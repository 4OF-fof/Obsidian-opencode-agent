import { ChatMessageDetail } from "../shared/types";
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
    return error === undefined ? "" : `Error\n${formatDetailValue(error)}`;
  }

  return formatToolText(args, output, error);
}

export function toolTitle(tool: string, input: unknown): string {
  if (isReadTool(tool)) {
    return `Read ${pathLabel(readToolPath(input))}`;
  }

  const command = readCommand(input);
  if (command || tool === "bash" || tool === "shell") {
    return "Run Command";
  }
  return tool ? `Tool call: ${tool}` : "Tool call";
}

export function toolFallbackText(value: JsonRecord, kind: ChatMessageDetail["kind"]): string {
  if (kind !== "tool") {
    return "";
  }

  const tool = readStringProperty(value, "tool") || readStringProperty(value, "name");
  const data = readProperty(value, "data");
  const state = readProperty(value, "state");
  const output =
    readProperty(value, "output") ??
    readProperty(data, "output") ??
    readProperty(state, "output");

  if (isReadTool(tool)) {
    return cleanReadOutput(output);
  }

  return cleanToolOutput(output);
}

function formatToolText(input: unknown, output: unknown, error: unknown): string {
  const parts: string[] = [];

  const command = readCommand(input);
  if (command) {
    parts.push(`Run Command\n${command}`);
  } else if (input !== undefined) {
    parts.push(`Input\n${formatDetailValue(input)}`);
  }

  if (output !== undefined) {
    parts.push(`Output\n${cleanToolOutput(output)}`);
  }

  if (error !== undefined) {
    parts.push(`Error\n${cleanToolOutput(error)}`);
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

function cleanReadOutput(value: unknown): string {
  const text = formatDetailValue(value).trim();
  if (!text) {
    return "";
  }

  const entriesMatch = text.match(/<entries>\s*([\s\S]*?)\s*<\/entries>/i);
  const body = entriesMatch ? entriesMatch[1] : text;
  return body
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => {
      const trimmed = line.trim();
      return (
        trimmed.length > 0 &&
        !/^<path>/i.test(trimmed) &&
        !/^<\/?type>/i.test(trimmed) &&
        !/^<\/?entries>/i.test(trimmed) &&
        !/^\(\d+\s+entries\)$/i.test(trimmed)
      );
    })
    .join("\n")
    .trim();
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
