import { requireAuthedUser } from "@/lib/auth";
import { getDistributionData } from "@/lib/dashboardData";
import DistributionClient from "@/components/DistributionClient";

export const dynamic = "force-dynamic";

export default async function DistributionPage() {
  const user = await requireAuthedUser();
  const data = await getDistributionData(user);
  return <DistributionClient {...data} />;
}
