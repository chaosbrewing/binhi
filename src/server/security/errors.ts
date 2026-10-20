export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const unauthorized = (msg = "Please sign in") => new HttpError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "You don't have access to this") => new HttpError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Not found") => new HttpError(404, "NOT_FOUND", msg);
export const badRequest = (msg: string, details?: unknown) => new HttpError(400, "BAD_REQUEST", msg, details);
export const conflict = (msg: string, details?: unknown) => new HttpError(409, "CONFLICT", msg, details);
export const tooMany = (msg = "Too many requests. Please wait a moment.") => new HttpError(429, "RATE_LIMITED", msg);
