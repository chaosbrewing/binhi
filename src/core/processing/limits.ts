import { ProcessingContractError } from "./errors.js";

export type PersistencePolicy = "none" | "explicit-private-save";

export interface ResourceLimitPolicy {
  maxInputBytes: number;
  maxOutputBytes: number;
  maxWorkUnits: number;
  timeoutMs: number;
  concurrentJobs: number;
  persistence: PersistencePolicy;
}

export interface ResourceUsage {
  inputBytes: number;
  outputBytes?: number;
  workUnits: number;
  elapsedMs?: number;
  activeJobs?: number;
}

const POSITIVE_INTEGER_FIELDS = [
  "maxInputBytes",
  "maxOutputBytes",
  "maxWorkUnits",
  "timeoutMs",
  "concurrentJobs",
] as const satisfies readonly (keyof ResourceLimitPolicy)[];

const NON_NEGATIVE_INTEGER_FIELDS = [
  "inputBytes",
  "outputBytes",
  "workUnits",
  "elapsedMs",
  "activeJobs",
] as const satisfies readonly (keyof ResourceUsage)[];

export function assertValidResourcePolicy(policy: ResourceLimitPolicy): ResourceLimitPolicy {
  for (const field of POSITIVE_INTEGER_FIELDS) {
    const value = policy[field];
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new ProcessingContractError("INVALID_POLICY", `${field} must be a positive safe integer.`, false, { field, value });
    }
  }
  if (policy.persistence !== "none" && policy.persistence !== "explicit-private-save") {
    throw new ProcessingContractError("INVALID_POLICY", "persistence is not supported.", false, { persistence: policy.persistence });
  }
  return policy;
}

export function assertWithinResourceLimits(policy: ResourceLimitPolicy, usage: ResourceUsage): ResourceUsage {
  assertValidResourcePolicy(policy);
  for (const field of NON_NEGATIVE_INTEGER_FIELDS) {
    const value = usage[field];
    if (value !== undefined && (!Number.isSafeInteger(value) || value < 0)) {
      throw new ProcessingContractError("INVALID_POLICY", `${field} must be a non-negative safe integer.`, false, { field, value });
    }
  }

  const checks: readonly [keyof ResourceUsage, number, number][] = [
    ["inputBytes", usage.inputBytes, policy.maxInputBytes],
    ["outputBytes", usage.outputBytes ?? 0, policy.maxOutputBytes],
    ["workUnits", usage.workUnits, policy.maxWorkUnits],
    ["elapsedMs", usage.elapsedMs ?? 0, policy.timeoutMs],
    ["activeJobs", usage.activeJobs ?? 0, policy.concurrentJobs],
  ];
  for (const [resource, actual, limit] of checks) {
    if (actual > limit) {
      const code = resource === "elapsedMs" ? "TIMEOUT" : "LIMIT_EXCEEDED";
      throw new ProcessingContractError(code, `${resource} exceeds the processing limit.`, false, { resource, actual, limit });
    }
  }
  return usage;
}

export const RASTER_RESOURCE_LIMITS: Readonly<ResourceLimitPolicy> = Object.freeze({
  maxInputBytes: 8 * 1024 * 1024,
  maxOutputBytes: 8 * 1024 * 1024,
  maxWorkUnits: 16_000_000,
  timeoutMs: 60_000,
  concurrentJobs: 1,
  persistence: "explicit-private-save",
});
