import { NextResponse } from "next/server";
import { errorToBody } from "@/lib/errors";
import type { JsonResult } from "@/lib/idempotency";

export type ApiErrorBody = {
  error: string;
  code: string;
};

export async function runJson<T>(handler: () => Promise<JsonResult<T>>): Promise<JsonResult<T>> {
  try {
    return await handler();
  } catch (error) {
    return errorToBody(error) as JsonResult<T>;
  }
}

export function jsonResponse<T>(result: JsonResult<T>) {
  return NextResponse.json(result.body, { status: result.status });
}
