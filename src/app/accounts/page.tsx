import { requireAuthedUser } from "@/lib/auth";
import { getClientOverviewData } from "@/lib/dashboardData";
import AccountsClient from "@/components/AccountsClient";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const user = await requireAuthedUser();
  const data = await getClientOverviewData(user);

  return (
    <AccountsClient
      clientName={data.clientName}
      accounts={data.accounts}
      connections={data.plaidItems ?? []}
    />
  );
}
