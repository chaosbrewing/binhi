import {
  ProcessingContractError,
  processingError,
  type ProcessingErrorContract,
} from "./errors.js";
import { assertAllowedOutput, type FormatPolicy } from "./formats.js";
import { assertWithinResourceLimits } from "./limits.js";

export const PROCESSING_JOB_STATES = [
  "QUEUED",
  "VALIDATING",
  "PROCESSING",
  "VERIFYING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
  "EXPIRED",
] as const;

export type ProcessingJobState = (typeof PROCESSING_JOB_STATES)[number];
export type ProcessingModule = "form" | "pdf" | "convert" | "optimize";

export interface ProcessingInputReference {
  filename: string;
  byteSize: number;
}

export interface ProcessingRequest<Options = unknown> {
  id: string;
  module: ProcessingModule;
  input: ProcessingInputReference;
  outputFormat: string;
  options: Options;
}

export interface ProcessingCandidateOutput {
  bytes: Uint8Array;
  mimeType: string;
  filename: string;
}

export type OutputVerificationName = "format" | "structure" | "size" | "dimensions" | "pages";

export interface OutputVerificationCheck {
  name: OutputVerificationName;
  passed: boolean;
  detail?: string;
}

export interface OutputVerification {
  valid: boolean;
  checks: readonly OutputVerificationCheck[];
}

export interface VerifiedProcessingOutput extends ProcessingCandidateOutput {
  byteSize: number;
  verification: OutputVerification & { valid: true };
}

export function createVerifiedProcessingOutput(
  candidate: ProcessingCandidateOutput,
  verification: OutputVerification,
  policy?: FormatPolicy,
): VerifiedProcessingOutput {
  if (!candidate.filename.trim() || !candidate.mimeType.trim() || candidate.bytes.byteLength === 0) {
    throw new ProcessingContractError("OUTPUT_VERIFICATION_FAILED", "Output metadata and bytes must be present.");
  }
  const required = new Set<OutputVerificationName>(["format", "structure", "size"]);
  const seen = new Set<OutputVerificationName>();
  for (const check of verification.checks) {
    if (seen.has(check.name)) {
      throw new ProcessingContractError("OUTPUT_VERIFICATION_FAILED", `Duplicate output verification check: ${check.name}.`);
    }
    seen.add(check.name);
    if (!check.passed) {
      throw new ProcessingContractError("OUTPUT_VERIFICATION_FAILED", `Output verification failed: ${check.name}.`, false, { check: check.name });
    }
  }
  if (!verification.valid || [...required].some((name) => !seen.has(name))) {
    throw new ProcessingContractError("OUTPUT_VERIFICATION_FAILED", "Output requires successful format, structure, and size verification.");
  }
  if (policy) {
    assertAllowedOutput(candidate.mimeType, policy);
    assertWithinResourceLimits(policy.resources, {
      inputBytes: 0,
      outputBytes: candidate.bytes.byteLength,
      workUnits: 0,
    });
  }
  return {
    ...candidate,
    byteSize: candidate.bytes.byteLength,
    verification: { valid: true, checks: verification.checks.map((check) => ({ ...check })) },
  };
}

export function assertVerifiedProcessingOutput(output: VerifiedProcessingOutput): VerifiedProcessingOutput {
  if (output.byteSize !== output.bytes.byteLength) {
    throw new ProcessingContractError("OUTPUT_VERIFICATION_FAILED", "Verified output byte size does not match its bytes.");
  }
  createVerifiedProcessingOutput(output, output.verification);
  return output;
}

interface ProcessingJobBase<Options> {
  request: ProcessingRequest<Options>;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
}

export interface QueuedProcessingJob<Options = unknown> extends ProcessingJobBase<Options> {
  state: "QUEUED";
}

export interface ValidatingProcessingJob<Options = unknown> extends ProcessingJobBase<Options> {
  state: "VALIDATING";
}

export interface ProcessingProcessingJob<Options = unknown> extends ProcessingJobBase<Options> {
  state: "PROCESSING";
  inputFormat: string;
  workUnits: number;
}

export interface VerifyingProcessingJob<Options = unknown> extends ProcessingJobBase<Options> {
  state: "VERIFYING";
  candidate: ProcessingCandidateOutput;
}

export interface CompletedProcessingJob<Options = unknown> extends ProcessingJobBase<Options> {
  state: "COMPLETED";
  output: VerifiedProcessingOutput;
}

export interface FailedProcessingJob<Options = unknown> extends ProcessingJobBase<Options> {
  state: "FAILED";
  error: ProcessingErrorContract;
}

export interface CancelledProcessingJob<Options = unknown> extends ProcessingJobBase<Options> {
  state: "CANCELLED";
  error: ProcessingErrorContract & { code: "CANCELLED" };
}

export interface ExpiredProcessingJob<Options = unknown> extends ProcessingJobBase<Options> {
  state: "EXPIRED";
  error: ProcessingErrorContract & { code: "TIMEOUT" };
}

export type ProcessingJob<Options = unknown> =
  | QueuedProcessingJob<Options>
  | ValidatingProcessingJob<Options>
  | ProcessingProcessingJob<Options>
  | VerifyingProcessingJob<Options>
  | CompletedProcessingJob<Options>
  | FailedProcessingJob<Options>
  | CancelledProcessingJob<Options>
  | ExpiredProcessingJob<Options>;

export type ProcessingJobEvent =
  | { type: "START_VALIDATION" }
  | { type: "START_PROCESSING"; inputFormat: string; workUnits: number }
  | { type: "START_VERIFICATION"; candidate: ProcessingCandidateOutput }
  | { type: "COMPLETE"; output: VerifiedProcessingOutput }
  | { type: "FAIL"; error: ProcessingErrorContract }
  | { type: "CANCEL"; reason?: string }
  | { type: "EXPIRE" };

const ACTIVE_STATES: readonly ProcessingJobState[] = ["QUEUED", "VALIDATING", "PROCESSING", "VERIFYING"];

export function createProcessingJob<Options>(
  request: ProcessingRequest<Options>,
  options: { now: number; ttlMs: number },
): QueuedProcessingJob<Options> {
  if (!request.id.trim() || !request.input.filename.trim() || !request.outputFormat.trim()) {
    throw new ProcessingContractError("INVALID_POLICY", "Processing requests require ids, filenames, and output formats.");
  }
  if (!Number.isSafeInteger(request.input.byteSize) || request.input.byteSize < 0) {
    throw new ProcessingContractError("INVALID_POLICY", "Input byte size must be a non-negative safe integer.");
  }
  if (!Number.isSafeInteger(options.now) || !Number.isSafeInteger(options.ttlMs) || options.ttlMs <= 0) {
    throw new ProcessingContractError("INVALID_POLICY", "Job timestamps and TTL must be valid positive integers.");
  }
  return {
    state: "QUEUED",
    request,
    createdAt: options.now,
    updatedAt: options.now,
    expiresAt: options.now + options.ttlMs,
  };
}

function invalidTransition(state: ProcessingJobState, event: ProcessingJobEvent["type"], reason?: string): never {
  throw new ProcessingContractError(
    "INVALID_TRANSITION",
    reason ?? `Cannot apply ${event} while a processing job is ${state}.`,
    false,
    { state, event },
  );
}

export function transitionProcessingJob<Options>(
  job: ProcessingJob<Options>,
  event: ProcessingJobEvent,
  at: number,
): ProcessingJob<Options> {
  if (!Number.isSafeInteger(at) || at < job.updatedAt) {
    throw new ProcessingContractError("INVALID_TRANSITION", "Job transition time cannot move backwards.");
  }
  if (!ACTIVE_STATES.includes(job.state)) return invalidTransition(job.state, event.type);

  if (event.type === "EXPIRE") {
    if (at < job.expiresAt) return invalidTransition(job.state, event.type, "A processing job cannot expire before its deadline.");
    return {
      ...job,
      state: "EXPIRED",
      updatedAt: at,
      error: { ...processingError("TIMEOUT", "Processing job expired."), code: "TIMEOUT" },
    };
  }
  if (at >= job.expiresAt) {
    return invalidTransition(job.state, event.type, "The processing job is expired and must transition to EXPIRED.");
  }
  if (event.type === "CANCEL") {
    return {
      ...job,
      state: "CANCELLED",
      updatedAt: at,
      error: {
        ...processingError("CANCELLED", event.reason?.trim() || "Processing job cancelled."),
        code: "CANCELLED",
      },
    };
  }
  if (event.type === "FAIL") {
    if (job.state === "QUEUED") return invalidTransition(job.state, event.type);
    return { ...job, state: "FAILED", updatedAt: at, error: event.error };
  }

  switch (job.state) {
    case "QUEUED":
      if (event.type === "START_VALIDATION") return { ...job, state: "VALIDATING", updatedAt: at };
      break;
    case "VALIDATING":
      if (event.type === "START_PROCESSING") {
        if (!event.inputFormat.trim() || !Number.isSafeInteger(event.workUnits) || event.workUnits < 0) {
          throw new ProcessingContractError("INVALID_POLICY", "Processing requires a format and non-negative work units.");
        }
        return { ...job, state: "PROCESSING", updatedAt: at, inputFormat: event.inputFormat, workUnits: event.workUnits };
      }
      break;
    case "PROCESSING":
      if (event.type === "START_VERIFICATION") {
        if (!event.candidate.bytes.byteLength) {
          throw new ProcessingContractError("OUTPUT_VERIFICATION_FAILED", "Empty output cannot be verified.");
        }
        return { ...job, state: "VERIFYING", updatedAt: at, candidate: event.candidate };
      }
      break;
    case "VERIFYING":
      if (event.type === "COMPLETE") {
        assertVerifiedProcessingOutput(event.output);
        if (event.output.mimeType !== job.request.outputFormat) {
          throw new ProcessingContractError("OUTPUT_VERIFICATION_FAILED", "Verified output format does not match the requested format.");
        }
        return { ...job, state: "COMPLETED", updatedAt: at, output: event.output };
      }
      break;
  }
  return invalidTransition(job.state, event.type);
}
