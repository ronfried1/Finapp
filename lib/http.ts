import { NextResponse } from "next/server";

export function unauthorized() {
  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function serverError(message = "Internal Server Error") {
  return NextResponse.json({ error: message }, { status: 500 });
}
