import { NextResponse } from "next/server";

const BACKEND_BASE_URL =
  process.env.SENTIRION_BACKEND_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_SENTIRION_API_BASE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:3001";

export async function GET(request) {
  const searchParams = request.nextUrl.searchParams.toString();
  const targetUrl = `${BACKEND_BASE_URL}/api/market-overview${searchParams ? `?${searchParams}` : ""}`;

  try {
    const response = await fetch(targetUrl, { cache: "no-store" });
    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const body =
      contentType.includes("application/json") && text
        ? JSON.parse(text)
        : { detail: text || "Unknown backend response" };

    if (!response.ok) {
      return NextResponse.json(body, { status: response.status });
    }

    return NextResponse.json(body);
  } catch {
    return NextResponse.json(
      {
        detail: `Could not reach Sentirion backend at ${BACKEND_BASE_URL}. Make sure the Python API is running.`,
      },
      { status: 502 }
    );
  }
}
