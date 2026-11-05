export const PROCESSING_ERROR_CODES = [
  "UNSUPPORTED_FORMAT",
  "MALFORMED_INPUT",
  "LIMIT_EXCEEDED",
  "OUT_OF_MEMORY",
  "TIMEOUT",
  "CANCELLED",
  "OUTPUT_VERIFICATION_FAILED",
  "PERSISTENCE_DENIED",
  "INVALID_TRANSITION",
  "INVALID_POLICY",
] as const;

export type ProcessingErrorCode = (typeof PROCESSING_ERROR_CODES)[number];

export interface ProcessingErrorContract {
  code: ProcessingErrorCode;
  message: string;
  retryable: boolean;
  details?: Readonly<Record<string, unknown>>;
}

export class ProcessingContractError extends Error {
  readonly name = "ProcessingContractError";

  constructor(
    readonly code: ProcessingErrorCode,
    message: string,
    readonly retryable = false,
    readonly details?: Readonly<Record<string, unknown>>,
  ) {
    super(message);
  }

  toContract(): ProcessingErrorContract {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export function isProcessingErrorCode(value: unknown): value is ProcessingErrorCode {
  return typeof value === "string" && (PROCESSING_ERROR_CODES as readonly string[]).includes(value);
}

export function processingError(
  code: ProcessingErrorCode,
  message: string,
  options: { retryable?: boolean; details?: Readonly<Record<string, unknown>> } = {},
): ProcessingErrorContract {
  const trimmed = message.trim();
  if (!trimmed) throw new ProcessingContractError("INVALID_POLICY", "Processing errors require a message.");
  return {
    code,
    message: trimmed,
    retryable: options.retryable ?? false,
    ...(options.details ? { details: options.details } : {}),
  };
}

export function normalizeProcessingError(error: unknown): ProcessingErrorContract {
  if (error instanceof ProcessingContractError) return error.toContract();
  if (error instanceof Error) {
    return processingError("MALFORMED_INPUT", error.message || "Processing failed.");
  }
  return processingError("MALFORMED_INPUT", "Processing failed.");
}
