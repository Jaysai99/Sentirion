import { NextResponse } from "next/server";

const BACKEND_BASE_URL =
  process.env.SENTIRION_BACKEND_URL?.replace(/\/$/, "") ||
  process.env.NEXT_PUBLIC_SENTIRION_API_BASE_URL?.replace(/\/$/, "") ||
  "http://127.0.0.1:3001";

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const query = resolvedParams?.query;
  const searchParams = request.nextUrl.searchParams.toString();
  const targetUrl = `${BACKEND_BASE_URL}/api/sentiment/${encodeURIComponent(query)}${
    searchParams ? `?${searchParams}` : ""
  }`;

  try {
    const response = await fetch(targetUrl, {
      cache: "no-store",
    });

    const text = await response.text();
    const contentType = response.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const body = isJson && text ? JSON.parse(text) : { detail: text || "Unknown backend response" };

    if (!response.ok) {
      return NextResponse.json(body, { status: response.status });
    }

    return NextResponse.json(body);
  } catch (error) {
    return NextResponse.json(
      {
        detail: `Could not reach the Sentirion backend at ${BACKEND_BASE_URL}. Make sure the Dekalb Capital Management platform API is running.`,
      },
      { status: 502 }
    );
  }
}
