export type MessagingCommandSource =
  | "numbered"
  | "keyword"
  | "structured"
  | "natural_language"
  | "none";

export interface MessagingCommand {
  kind: string;
  source: MessagingCommandSource;
  action: string;
  value: string | null;
  status: "parsed" | "proposed" | "unrecognized";
  requiresValidation: boolean;
}

export const MESSAGE_TEXT_MAX_CHARS: number;
export const MESSAGE_COMMAND_MAX_DIGITS: number;
export const MESSAGE_MMS_MAX_ATTACHMENTS: number;

export function parseMessagingCommand(value: string): MessagingCommand;

export function validateMessagingCommand(command: MessagingCommand): {
  accepted: boolean;
  state:
    | "navigation"
    | "verification_required"
    | "validation_required"
    | "rejected";
  action: string;
};

export function summarizeMessageForTelemetry(input: {
  text: string;
  attachmentCount?: number;
  command?: MessagingCommand | null;
}): {
  textLength: number;
  attachmentCount: number;
  commandKind: string | null;
  commandSource: MessagingCommandSource | null;
  rawTextExcluded: true;
};
