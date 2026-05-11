export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function badRequest(message: string) {
  return new HttpError(400, message, "bad_request");
}

export function notFound(message: string) {
  return new HttpError(404, message, "not_found");
}

export function conflict(message: string) {
  return new HttpError(409, message, "conflict");
}

export function gone(message: string) {
  return new HttpError(410, message, "gone");
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export function errorToBody(error: unknown) {
  if (isHttpError(error)) {
    return {
      status: error.status,
      body: { error: error.message, code: error.code },
    };
  }

  return {
    status: 500,
    body: { error: "Internal Server Error", code: "internal_server_error" },
  };
}
