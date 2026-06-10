const rank: Record<string, number> = {
  READER: 1,
  AUTHOR: 2,
  ADMIN: 3,
  SUPER_ADMIN: 4,
};

export const roles = {
  Reader: "READER",
  Author: "AUTHOR",
  Admin: "ADMIN",
  SuperAdmin: "SUPER_ADMIN",
  hasAtLeast(userRole: string, required: string) {
    return (rank[userRole] ?? 0) >= (rank[required] ?? 0);
  },
};
