import { NextResponse } from "next/server";
import { CountryCode, LinkTokenCreateRequest, Products } from "plaid";
import { plaidClient } from "@/lib/plaid";
import { getAuthedUser } from "@/lib/auth";

export async function POST() {
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET) {
    return NextResponse.json(
      { error: "Missing PLAID_CLIENT_ID or PLAID_SECRET in .env" },
      { status: 400 }
    );
  }

  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const request: LinkTokenCreateRequest = {
    user: {
      client_user_id: user.id,
    },
    client_name: "Arbor",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
  };

  if (process.env.PLAID_REDIRECT_URI) {
    request.redirect_uri = process.env.PLAID_REDIRECT_URI;
  }

  try {
    const response = await plaidClient.linkTokenCreate(request);
    return NextResponse.json({ link_token: response.data.link_token });
  } catch (error: any) {
    const plaidError = error?.response?.data ?? { message: "Unknown Plaid error" };
    return NextResponse.json(
      {
        error: "Plaid link-token failed",
        plaid: plaidError,
      },
      { status: 500 }
    );
  }
}
