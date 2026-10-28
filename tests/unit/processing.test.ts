import { describe, expect, it } from "vitest";
import {
  IMAGE_OPTIMIZATION_POLICY,
  PROCESSING_ERROR_CODES,
  PROCESSING_JOB_STATES,
  ProcessingContractError,
  RASTER_CONVERSION_POLICY,
  RASTER_FORMATS,
  RASTER_RESOURCE_LIMITS,
  assertAllowedInput,
  assertAllowedOutput,
  assertValidFormatPolicy,
  assertValidResourcePolicy,
  assertVerifiedProcessingOutput,
  assertWithinResourceLimits,
  createProcessingJob,
  createVerifiedProcessingOutput,
  detectFormat,
  isProcessingErrorCode,
  normalizeProcessingError,
  processingError,
  transitionProcessingJob,
  type FormatPolicy,
  type ProcessingCandidateOutput,
  type ProcessingJob,
  type ProcessingRequest,
  type ResourceLimitPolicy,
  type VerifiedProcessingOutput,
} from "../../src/core/processing/index.js";

const png = () => new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0]);
const jpeg = () => new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const webp = () => new Uint8Array([0x52, 0x49, 0x46, 0x46, 4, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
const request = (): ProcessingRequest<{ quality: number }> => ({
  id: "job_1",
  module: "optimize",
  input: { filename: "source.png", byteSize: 12 },
  outputFormat: "image/png",
  options: { quality: 90 },
});
const candidate = (): ProcessingCandidateOutput => ({
  bytes: png(),
  mimeType: "image/png",
  filename: "optimized.png",
});
const verification = () => ({
  valid: true,
  checks: [
    { name: "format" as const, passed: true },
    { name: "structure" as const, passed: true },
    { name: "size" as const, passed: true },
  ],
});
const verifiedOutput = () => createVerifiedProcessingOutput(candidate(), verification(), IMAGE_OPTIMIZATION_POLICY);

function errorCode(run: () => unknown): string | undefined {
  try {
    run();
  } catch (error) {
    return error instanceof ProcessingContractError ? error.code : undefined;
  }
  return undefined;
}

describe("processing lifecycle contract", () => {
  it("publishes the exact approved states", () => {
    expect(PROCESSING_JOB_STATES).toEqual([
      "QUEUED", "VALIDATING", "PROCESSING", "VERIFYING",
      "COMPLETED", "FAILED", "CANCELLED", "EXPIRED",
    ]);
  });

  it("creates a bounded queued job", () => {
    expect(createProcessingJob(request(), { now: 100, ttlMs: 1_000 })).toMatchObject({
      state: "QUEUED",
      createdAt: 100,
      updatedAt: 100,
      expiresAt: 1_100,
    });
  });

  it("rejects malformed requests and timing", () => {
    expect(() => createProcessingJob({ ...request(), id: "" }, { now: 0, ttlMs: 1 })).toThrow(ProcessingContractError);
    expect(() => createProcessingJob({ ...request(), input: { filename: "x", byteSize: -1 } }, { now: 0, ttlMs: 1 })).toThrow();
    expect(() => createProcessingJob(request(), { now: 0, ttlMs: 0 })).toThrow();
  });

  it("moves through validation, processing, verification, and verified completion", () => {
    let job: ProcessingJob<{ quality: number }> = createProcessingJob(request(), { now: 100, ttlMs: 1_000 });
    job = transitionProcessingJob(job, { type: "START_VALIDATION" }, 101);
    expect(job.state).toBe("VALIDATING");
    job = transitionProcessingJob(job, { type: "START_PROCESSING", inputFormat: "image/png", workUnits: 12 }, 102);
    expect(job).toMatchObject({ state: "PROCESSING", inputFormat: "image/png", workUnits: 12 });
    job = transitionProcessingJob(job, { type: "START_VERIFICATION", candidate: candidate() }, 103);
    expect(job.state).toBe("VERIFYING");
    job = transitionProcessingJob(job, { type: "COMPLETE", output: verifiedOutput() }, 104);
    expect(job).toMatchObject({ state: "COMPLETED", output: { byteSize: 12, verification: { valid: true } } });
  });

  it("rejects out-of-order and backwards-time transitions", () => {
    const queued = createProcessingJob(request(), { now: 100, ttlMs: 1_000 });
    expect(errorCode(() => transitionProcessingJob(queued, { type: "START_PROCESSING", inputFormat: "image/png", workUnits: 1 }, 101))).toBe("INVALID_TRANSITION");
    const validating = transitionProcessingJob(queued, { type: "START_VALIDATION" }, 101);
    expect(errorCode(() => transitionProcessingJob(validating, { type: "START_PROCESSING", inputFormat: "image/png", workUnits: 1 }, 99))).toBe("INVALID_TRANSITION");
    expect(() => transitionProcessingJob(validating, { type: "START_PROCESSING", inputFormat: "", workUnits: -1 }, 102)).toThrow("format");
  });

  it("allows failure only after work starts and makes failure terminal", () => {
    const queued = createProcessingJob(request(), { now: 0, ttlMs: 100 });
    const failure = processingError("MALFORMED_INPUT", "Bad image.");
    expect(errorCode(() => transitionProcessingJob(queued, { type: "FAIL", error: failure }, 1))).toBe("INVALID_TRANSITION");
    const validating = transitionProcessingJob(queued, { type: "START_VALIDATION" }, 1);
    const failed = transitionProcessingJob(validating, { type: "FAIL", error: failure }, 2);
    expect(failed).toMatchObject({ state: "FAILED", error: { code: "MALFORMED_INPUT" } });
    expect(errorCode(() => transitionProcessingJob(failed, { type: "CANCEL" }, 3))).toBe("INVALID_TRANSITION");
  });

  it.each(["QUEUED", "VALIDATING", "PROCESSING", "VERIFYING"] as const)(
    "cancels active state %s and makes it terminal",
    (target) => {
      let job: ProcessingJob = createProcessingJob(request(), { now: 0, ttlMs: 100 });
      if (target !== "QUEUED") job = transitionProcessingJob(job, { type: "START_VALIDATION" }, 1);
      if (target === "PROCESSING" || target === "VERIFYING") {
        job = transitionProcessingJob(job, { type: "START_PROCESSING", inputFormat: "image/png", workUnits: 1 }, 2);
      }
      if (target === "VERIFYING") job = transitionProcessingJob(job, { type: "START_VERIFICATION", candidate: candidate() }, 3);
      const cancelled = transitionProcessingJob(job, { type: "CANCEL", reason: "User stopped." }, 4);
      expect(cancelled).toMatchObject({ state: "CANCELLED", error: { code: "CANCELLED", message: "User stopped." } });
      expect(errorCode(() => transitionProcessingJob(cancelled, { type: "EXPIRE" }, 101))).toBe("INVALID_TRANSITION");
    },
  );

  it("expires only at the deadline and rejects ordinary events after it", () => {
    const job = createProcessingJob(request(), { now: 10, ttlMs: 10 });
    expect(errorCode(() => transitionProcessingJob(job, { type: "EXPIRE" }, 19))).toBe("INVALID_TRANSITION");
    expect(errorCode(() => transitionProcessingJob(job, { type: "START_VALIDATION" }, 20))).toBe("INVALID_TRANSITION");
    expect(transitionProcessingJob(job, { type: "EXPIRE" }, 20)).toMatchObject({
      state: "EXPIRED",
      error: { code: "TIMEOUT" },
    });
  });
});

describe("verified completion contract", () => {
  it("requires successful format, structure, and size checks", () => {
    for (const invalid of [
      { ...verification(), valid: false },
      { valid: true, checks: verification().checks.filter((check) => check.name !== "structure") },
      { valid: true, checks: verification().checks.map((check) => check.name === "format" ? { ...check, passed: false } : check) },
      { valid: true, checks: [...verification().checks, { name: "format" as const, passed: true }] },
    ]) {
      expect(errorCode(() => createVerifiedProcessingOutput(candidate(), invalid))).toBe("OUTPUT_VERIFICATION_FAILED");
    }
  });

  it("rejects empty outputs, unsupported output formats, and resource excess", () => {
    expect(errorCode(() => createVerifiedProcessingOutput({ ...candidate(), bytes: new Uint8Array() }, verification()))).toBe("OUTPUT_VERIFICATION_FAILED");
    expect(errorCode(() => createVerifiedProcessingOutput({ ...candidate(), mimeType: "image/gif" }, verification(), RASTER_CONVERSION_POLICY))).toBe("UNSUPPORTED_FORMAT");
    const tinyPolicy = { ...RASTER_CONVERSION_POLICY, resources: { ...RASTER_RESOURCE_LIMITS, maxOutputBytes: 2 } };
    expect(errorCode(() => createVerifiedProcessingOutput(candidate(), verification(), tinyPolicy))).toBe("LIMIT_EXCEEDED");
  });

  it("detects post-verification byte-size tampering", () => {
    const output = { ...verifiedOutput(), byteSize: 1 };
    expect(errorCode(() => assertVerifiedProcessingOutput(output))).toBe("OUTPUT_VERIFICATION_FAILED");
  });

  it("prevents completion with an invalid or wrong-format output", () => {
    let job: ProcessingJob = createProcessingJob(request(), { now: 0, ttlMs: 100 });
    job = transitionProcessingJob(job, { type: "START_VALIDATION" }, 1);
    job = transitionProcessingJob(job, { type: "START_PROCESSING", inputFormat: "image/png", workUnits: 1 }, 2);
    job = transitionProcessingJob(job, { type: "START_VERIFICATION", candidate: candidate() }, 3);
    const fake = { ...candidate(), byteSize: 12, verification: { valid: false, checks: [] } } as unknown as VerifiedProcessingOutput;
    expect(errorCode(() => transitionProcessingJob(job, { type: "COMPLETE", output: fake }, 4))).toBe("OUTPUT_VERIFICATION_FAILED");
    const wrong = createVerifiedProcessingOutput({ ...candidate(), mimeType: "image/jpeg" }, verification());
    expect(errorCode(() => transitionProcessingJob(job, { type: "COMPLETE", output: wrong }, 4))).toBe("OUTPUT_VERIFICATION_FAILED");
  });
});

describe("format detection and policy", () => {
  it("detects PNG, JPEG, and WebP from magic bytes", () => {
    expect(detectFormat(png())?.id).toBe("image/png");
    expect(detectFormat(jpeg())?.id).toBe("image/jpeg");
    expect(detectFormat(webp())?.id).toBe("image/webp");
    expect(detectFormat(new TextEncoder().encode("<svg/>"))).toBeNull();
  });

  it("requires every rule in a compound signature", () => {
    const malformed = webp();
    malformed[8] = 0;
    expect(detectFormat(malformed)).toBeNull();
  });

  it("accepts allowed magic and rejects unsupported or oversized input", () => {
    expect(assertAllowedInput(png(), RASTER_CONVERSION_POLICY).id).toBe("image/png");
    expect(errorCode(() => assertAllowedInput(new TextEncoder().encode("GIF89a"), RASTER_CONVERSION_POLICY))).toBe("UNSUPPORTED_FORMAT");
    const oversized = new Uint8Array(RASTER_RESOURCE_LIMITS.maxInputBytes + 1);
    oversized.set(png());
    expect(errorCode(() => assertAllowedInput(oversized, RASTER_CONVERSION_POLICY))).toBe("LIMIT_EXCEEDED");
  });

  it("validates known, unique input and output formats", () => {
    expect(assertValidFormatPolicy(RASTER_CONVERSION_POLICY)).toBe(RASTER_CONVERSION_POLICY);
    for (const policy of [
      { ...RASTER_CONVERSION_POLICY, inputs: [] },
      { ...RASTER_CONVERSION_POLICY, inputs: ["image/png", "image/png"] },
      { ...RASTER_CONVERSION_POLICY, outputs: ["application/pdf"] },
    ] as FormatPolicy[]) {
      expect(errorCode(() => assertValidFormatPolicy(policy, RASTER_FORMATS))).toBe("INVALID_POLICY");
    }
    expect(assertAllowedOutput("image/webp", RASTER_CONVERSION_POLICY)).toBe("image/webp");
    expect(errorCode(() => assertAllowedOutput("image/gif", RASTER_CONVERSION_POLICY))).toBe("UNSUPPORTED_FORMAT");
  });
});

describe("resource policy", () => {
  it("accepts valid policies and usage exactly at each boundary", () => {
    expect(assertValidResourcePolicy(RASTER_RESOURCE_LIMITS)).toBe(RASTER_RESOURCE_LIMITS);
    expect(assertWithinResourceLimits(RASTER_RESOURCE_LIMITS, {
      inputBytes: RASTER_RESOURCE_LIMITS.maxInputBytes,
      outputBytes: RASTER_RESOURCE_LIMITS.maxOutputBytes,
      workUnits: RASTER_RESOURCE_LIMITS.maxWorkUnits,
      elapsedMs: RASTER_RESOURCE_LIMITS.timeoutMs,
      activeJobs: RASTER_RESOURCE_LIMITS.concurrentJobs,
    })).toBeTruthy();
  });

  it("rejects every exceeded resource with a stable contract", () => {
    const cases = [
      { inputBytes: RASTER_RESOURCE_LIMITS.maxInputBytes + 1, workUnits: 0 },
      { inputBytes: 0, outputBytes: RASTER_RESOURCE_LIMITS.maxOutputBytes + 1, workUnits: 0 },
      { inputBytes: 0, workUnits: RASTER_RESOURCE_LIMITS.maxWorkUnits + 1 },
      { inputBytes: 0, workUnits: 0, activeJobs: RASTER_RESOURCE_LIMITS.concurrentJobs + 1 },
    ];
    for (const usage of cases) expect(errorCode(() => assertWithinResourceLimits(RASTER_RESOURCE_LIMITS, usage))).toBe("LIMIT_EXCEEDED");
    expect(errorCode(() => assertWithinResourceLimits(RASTER_RESOURCE_LIMITS, {
      inputBytes: 0,
      workUnits: 0,
      elapsedMs: RASTER_RESOURCE_LIMITS.timeoutMs + 1,
    }))).toBe("TIMEOUT");
  });

  it("rejects malformed policy and usage values", () => {
    for (const policy of [
      { ...RASTER_RESOURCE_LIMITS, maxInputBytes: 0 },
      { ...RASTER_RESOURCE_LIMITS, timeoutMs: 1.5 },
      { ...RASTER_RESOURCE_LIMITS, persistence: "automatic" },
    ] as ResourceLimitPolicy[]) {
      expect(errorCode(() => assertValidResourcePolicy(policy))).toBe("INVALID_POLICY");
    }
    expect(errorCode(() => assertWithinResourceLimits(RASTER_RESOURCE_LIMITS, { inputBytes: -1, workUnits: 0 }))).toBe("INVALID_POLICY");
  });
});

describe("processing error contracts", () => {
  it("publishes stable codes and recognizes only those codes", () => {
    expect(PROCESSING_ERROR_CODES).toContain("INVALID_TRANSITION");
    expect(isProcessingErrorCode("OUTPUT_VERIFICATION_FAILED")).toBe(true);
    expect(isProcessingErrorCode("UNKNOWN")).toBe(false);
  });

  it("creates serializable errors and rejects blank messages", () => {
    expect(processingError("TIMEOUT", "  Timed out.  ", { retryable: true, details: { elapsedMs: 1 } })).toEqual({
      code: "TIMEOUT",
      message: "Timed out.",
      retryable: true,
      details: { elapsedMs: 1 },
    });
    expect(errorCode(() => processingError("TIMEOUT", " "))).toBe("INVALID_POLICY");
  });

  it("normalizes contract, native, and unknown errors", () => {
    expect(normalizeProcessingError(new ProcessingContractError("LIMIT_EXCEEDED", "Too large."))).toMatchObject({ code: "LIMIT_EXCEEDED" });
    expect(normalizeProcessingError(new Error("Broken."))).toMatchObject({ code: "MALFORMED_INPUT", message: "Broken." });
    expect(normalizeProcessingError(null)).toMatchObject({ code: "MALFORMED_INPUT" });
  });
});
