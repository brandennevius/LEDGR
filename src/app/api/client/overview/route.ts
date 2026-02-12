import { NextResponse } from "next/server";

import { getAuthedUser } from "@/lib/auth";
import { getClientOverviewData } from "@/lib/dashboardData";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getClientOverviewData(user);
  return NextResponse.json(data, { status: 200 });
}
