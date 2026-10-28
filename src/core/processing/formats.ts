import { ProcessingContractError } from "./errors.js";
import { assertValidResourcePolicy, RASTER_RESOURCE_LIMITS, type ResourceLimitPolicy } from "./limits.js";

export interface MagicRule {
  offset: number;
  bytes: readonly number[];
  mask?: readonly number[];
}

export interface MagicSignature {
  rules: readonly MagicRule[];
}

export interface FormatDescriptor {
  id: string;
  extensions: readonly string[];
  signatures: readonly MagicSignature[];
}

export interface FormatPolicy {
  module: "form" | "pdf" | "convert" | "optimize";
  inputs: readonly string[];
  outputs: readonly string[];
  resources: Readonly<ResourceLimitPolicy>;
  processingLocation: "local" | "server";
}

const PNG: Readonly<FormatDescriptor> = Object.freeze({
  id: "image/png",
  extensions: [".png"],
  signatures: [{ rules: [{ offset: 0, bytes: [137, 80, 78, 71, 13, 10, 26, 10] }] }],
});

const JPEG: Readonly<FormatDescriptor> = Object.freeze({
  id: "image/jpeg",
  extensions: [".jpg", ".jpeg"],
  signatures: [{ rules: [{ offset: 0, bytes: [0xff, 0xd8, 0xff] }] }],
});

const WEBP: Readonly<FormatDescriptor> = Object.freeze({
  id: "image/webp",
  extensions: [".webp"],
  signatures: [{
    rules: [
      { offset: 0, bytes: [0x52, 0x49, 0x46, 0x46] },
      { offset: 8, bytes: [0x57, 0x45, 0x42, 0x50] },
    ],
  }],
});

export const RASTER_FORMATS: readonly Readonly<FormatDescriptor>[] = Object.freeze([PNG, JPEG, WEBP]);

export const RASTER_CONVERSION_POLICY: Readonly<FormatPolicy> = Object.freeze({
  module: "convert",
  inputs: RASTER_FORMATS.map((format) => format.id),
  outputs: RASTER_FORMATS.map((format) => format.id),
  resources: RASTER_RESOURCE_LIMITS,
  processingLocation: "local",
});

export const IMAGE_OPTIMIZATION_POLICY: Readonly<FormatPolicy> = Object.freeze({
  ...RASTER_CONVERSION_POLICY,
  module: "optimize",
});

function ruleMatches(bytes: Uint8Array, rule: MagicRule): boolean {
  if (!Number.isSafeInteger(rule.offset) || rule.offset < 0 || !rule.bytes.length) return false;
  if (rule.mask && rule.mask.length !== rule.bytes.length) return false;
  if (rule.offset + rule.bytes.length > bytes.length) return false;
  return rule.bytes.every((expected, index) => {
    const actual = bytes[rule.offset + index]!;
    const mask = rule.mask?.[index] ?? 0xff;
    return (actual & mask) === (expected & mask);
  });
}

export function detectFormat(
  bytes: Uint8Array,
  formats: readonly Readonly<FormatDescriptor>[] = RASTER_FORMATS,
): Readonly<FormatDescriptor> | null {
  for (const format of formats) {
    if (format.signatures.some((signature) => signature.rules.length > 0 && signature.rules.every((rule) => ruleMatches(bytes, rule)))) {
      return format;
    }
  }
  return null;
}

export function assertValidFormatPolicy(
  policy: FormatPolicy,
  formats: readonly Readonly<FormatDescriptor>[] = RASTER_FORMATS,
): FormatPolicy {
  assertValidResourcePolicy(policy.resources);
  if (!policy.inputs.length || !policy.outputs.length) {
    throw new ProcessingContractError("INVALID_POLICY", "Format policies require at least one input and output.");
  }
  const known = new Set(formats.map((format) => format.id));
  for (const id of [...policy.inputs, ...policy.outputs]) {
    if (!known.has(id)) throw new ProcessingContractError("INVALID_POLICY", `Unknown format in policy: ${id}`, false, { id });
  }
  if (new Set(policy.inputs).size !== policy.inputs.length || new Set(policy.outputs).size !== policy.outputs.length) {
    throw new ProcessingContractError("INVALID_POLICY", "Format policies cannot contain duplicate formats.");
  }
  return policy;
}

export function assertAllowedInput(
  bytes: Uint8Array,
  policy: FormatPolicy,
  formats: readonly Readonly<FormatDescriptor>[] = RASTER_FORMATS,
): Readonly<FormatDescriptor> {
  assertValidFormatPolicy(policy, formats);
  if (bytes.byteLength > policy.resources.maxInputBytes) {
    throw new ProcessingContractError("LIMIT_EXCEEDED", "Input exceeds the processing byte limit.", false, {
      resource: "inputBytes",
      actual: bytes.byteLength,
      limit: policy.resources.maxInputBytes,
    });
  }
  const detected = detectFormat(bytes, formats);
  if (!detected || !policy.inputs.includes(detected.id)) {
    throw new ProcessingContractError("UNSUPPORTED_FORMAT", "Input format is unsupported.");
  }
  return detected;
}

export function assertAllowedOutput(formatId: string, policy: FormatPolicy): string {
  assertValidFormatPolicy(policy);
  if (!policy.outputs.includes(formatId)) {
    throw new ProcessingContractError("UNSUPPORTED_FORMAT", "Output format is unsupported.", false, { formatId });
  }
  return formatId;
}
