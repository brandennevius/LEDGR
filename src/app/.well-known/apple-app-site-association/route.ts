import { NextResponse } from "next/server";

const TEAM_ID_FALLBACK = "2R4B5V7VLW";
const BUNDLE_ID_FALLBACK = "com.brandennevius.ledgr";

export async function GET() {
  const teamId = process.env.APPLE_TEAM_ID ?? TEAM_ID_FALLBACK;
  const bundleId = process.env.EXPO_IOS_BUNDLE_IDENTIFIER ?? BUNDLE_ID_FALLBACK;
  const appId = `${teamId}.${bundleId}`;

  return NextResponse.json(
    {
      applinks: {
        apps: [],
        details: [
          {
            appID: appId,
            paths: ["/plaid/oauth*"],
          },
        ],
      },
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300",
      },
    }
  );
}
