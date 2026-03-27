import { NextResponse } from "next/server";
import { getAuthedUser } from "@/lib/auth";
import { deleteUserAccountData } from "@/lib/accountDeletion";

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    confirmation?: string;
    email?: string;
  };

  if (body.confirmation !== "DELETE") {
    return NextResponse.json(
      { error: 'Type DELETE to confirm account deletion.' },
      { status: 400 }
    );
  }

  if ((body.email ?? "").trim().toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json(
      { error: "Email confirmation does not match the signed-in account." },
      { status: 400 }
    );
  }

  const result = await deleteUserAccountData(user.id);

  return NextResponse.json({
    ok: true,
    ...result,
  });
}

