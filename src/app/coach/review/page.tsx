import CoachReviewClient from "@/components/CoachReviewClient";
import { requireAuthedUser } from "@/lib/auth";
import { getClientOverviewData } from "@/lib/dashboardData";

export const dynamic = "force-dynamic";

export default async function CoachReviewPage() {
  const user = await requireAuthedUser();
  const data = await getClientOverviewData(user);
  return (
    <CoachReviewClient
      clientName={data.clientName}
      snapshot={data.snapshot}
      review={data.review}
    />
  );
}
