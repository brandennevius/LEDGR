import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/policies";

export async function POST(request: Request) {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    acceptTerms?: boolean;
    acceptPrivacy?: boolean;
  };

  if (!body.acceptTerms || !body.acceptPrivacy) {
    return NextResponse.json(
      { error: "Both terms and privacy acceptance are required." },
      { status: 400 }
    );
  }

  await prisma.$transaction([
    prisma.policyAcceptance.upsert({
      where: {
        userId_policyType_version: {
          userId: user.id,
          policyType: "TERMS",
          version: TERMS_VERSION,
        },
      },
      update: { acceptedAt: new Date() },
      create: {
        userId: user.id,
        policyType: "TERMS",
        version: TERMS_VERSION,
      },
    }),
    prisma.policyAcceptance.upsert({
      where: {
        userId_policyType_version: {
          userId: user.id,
          policyType: "PRIVACY",
          version: PRIVACY_VERSION,
        },
      },
      update: { acceptedAt: new Date() },
      create: {
        userId: user.id,
        policyType: "PRIVACY",
        version: PRIVACY_VERSION,
      },
    }),
  ]);

  return NextResponse.json({ ok: true });
}

