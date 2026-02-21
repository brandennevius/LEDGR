import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getAuthedUser } from "@/lib/auth";
import { PRIVACY_VERSION, TERMS_VERSION } from "@/lib/policies";

export async function GET() {
  const user = await getAuthedUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const records = await prisma.policyAcceptance.findMany({
    where: {
      userId: user.id,
      OR: [
        { policyType: "TERMS", version: TERMS_VERSION },
        { policyType: "PRIVACY", version: PRIVACY_VERSION },
      ],
    },
    select: {
      policyType: true,
      version: true,
      acceptedAt: true,
    },
  });

  const hasTerms = records.some(
    (record) => record.policyType === "TERMS" && record.version === TERMS_VERSION
  );
  const hasPrivacy = records.some(
    (record) =>
      record.policyType === "PRIVACY" && record.version === PRIVACY_VERSION
  );

  return NextResponse.json({
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    termsAccepted: hasTerms,
    privacyAccepted: hasPrivacy,
    requiresAcceptance: !(hasTerms && hasPrivacy),
  });
}

