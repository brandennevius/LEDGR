import { prisma } from "@/lib/db";

export const getDemoClient = async () => {
  return prisma.user.upsert({
    where: { email: "demo@ledgr.app" },
    update: {},
    create: {
      email: "demo@ledgr.app",
      name: "Alex Rivera",
      role: "CLIENT",
    },
  });
};
