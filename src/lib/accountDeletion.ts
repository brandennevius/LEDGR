import { createClient } from "@supabase/supabase-js";
import { prisma } from "@/lib/db";

const getSupabaseAdminClient = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE;

  if (!url || !serviceRoleKey) return null;

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
};

export async function deleteUserAccountData(userId: string) {
  const deleted = await prisma.$transaction(async (tx) => {
    const messagesDeleted = await tx.message.deleteMany({
      where: {
        OR: [
          { senderId: userId },
          { thread: { coachId: userId } },
          { thread: { clientId: userId } },
        ],
      },
    });
    const threadsDeleted = await tx.thread.deleteMany({
      where: {
        OR: [{ coachId: userId }, { clientId: userId }],
      },
    });
    const coachLinksDeleted = await tx.coachClient.deleteMany({
      where: {
        OR: [{ coachId: userId }, { clientId: userId }],
      },
    });
    const reviewsDeleted = await tx.coachReview.deleteMany({
      where: {
        OR: [{ coachId: userId }, { clientId: userId }],
      },
    });
    const goalsDeleted = await tx.goal.deleteMany({ where: { userId } });
    const categoryGroupsDeleted = await tx.categoryGroup.deleteMany({ where: { userId } });
    const categoryRulesDeleted = await tx.categoryRule.deleteMany({ where: { userId } });
    const categoriesDeleted = await tx.category.deleteMany({ where: { userId } });
    const policyAcceptancesDeleted = await tx.policyAcceptance.deleteMany({ where: { userId } });
    const transactionsDeleted = await tx.transaction.deleteMany({ where: { userId } });
    const accountsDeleted = await tx.account.deleteMany({ where: { userId } });
    const plaidItemsDeleted = await tx.plaidItem.deleteMany({ where: { userId } });
    const usersDeleted = await tx.user.deleteMany({ where: { id: userId } });

    return {
      messages: messagesDeleted.count,
      threads: threadsDeleted.count,
      coachLinks: coachLinksDeleted.count,
      reviews: reviewsDeleted.count,
      goals: goalsDeleted.count,
      categoryGroups: categoryGroupsDeleted.count,
      categoryRules: categoryRulesDeleted.count,
      categories: categoriesDeleted.count,
      policyAcceptances: policyAcceptancesDeleted.count,
      transactions: transactionsDeleted.count,
      accounts: accountsDeleted.count,
      plaidItems: plaidItemsDeleted.count,
      users: usersDeleted.count,
    };
  });

  const supabaseAdmin = getSupabaseAdminClient();
  if (!supabaseAdmin) {
    return {
      deleted,
      authUserDeleted: false,
      authDeletionSkipped: true,
    };
  }

  const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
  if (error) {
    return {
      deleted,
      authUserDeleted: false,
      authDeletionSkipped: false,
      authDeletionError: error.message,
    };
  }

  return {
    deleted,
    authUserDeleted: true,
    authDeletionSkipped: false,
  };
}

