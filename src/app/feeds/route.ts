import { NextResponse } from "next/server";

import { getFeedList } from "@/lib/services/feed-service";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getFeedList());
}
