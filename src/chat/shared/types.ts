export interface OpenCodeChatSettings {
  serverAddress: string;
  providerID: string;
  modelID: string;
  reasoningEffort: ReasoningEffort;
  visibleModelIDs: string[];
  favoriteReasoningEffortsByModel: Record<string, ReasoningEffort[]>;
}

export const DEFAULT_SETTINGS: OpenCodeChatSettings = {
  serverAddress: "127.0.0.1:4097",
  providerID: "",
  modelID: "",
  reasoningEffort: "",
  visibleModelIDs: [],
  favoriteReasoningEffortsByModel: {},
};

export type ReasoningEffort = string;

export interface ChatMessage {
  role: "user" | "assistant" | "error";
  text: string;
  details?: ChatMessageDetail[];
  blocks?: ChatMessageBlock[];
}

export interface ChatMessageDetail {
  kind: "reasoning" | "tool" | "other";
  title: string;
  text: string;
}

export type ChatMessageBlock =
  | { type: "text"; text: string }
  | { type: "detail"; detail: ChatMessageDetail };

export interface OpenCodeModelOption {
  providerID: string;
  modelID: string;
  label: string;
  effortOptions: ReasoningEffort[];
}

export interface OpenCodeSessionOption {
  id: string;
  title: string;
  path: string;
  updatedAt: number;
}

export interface OpenCodeQuestionOption {
  label: string;
  description: string;
}

export interface OpenCodeQuestionInfo {
  question: string;
  header: string;
  options: OpenCodeQuestionOption[];
  multiple: boolean;
  custom: boolean;
}

export interface OpenCodeQuestionRequest {
  id: string;
  sessionID: string;
  questions: OpenCodeQuestionInfo[];
}

export type OpenCodeQuestionAnswer = string[];

export type OpenCodeQuestionResolution =
  | { type: "reply"; answers: OpenCodeQuestionAnswer[] }
  | { type: "reject" };

export interface ServerAddress {
  host: string;
  port: number;
}
