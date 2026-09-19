import { jsonb, pgEnum, pgTable, text, timestamp, uuid, boolean } from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["admin", "engineer", "security", "viewer"]);

export const usersTable = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  organization: text("organization").notNull().default("AegisAI"),
  role: userRoleEnum("role").notNull().default("viewer"),
  avatarUrl: text("avatar_url"),
  notificationPreferences: jsonb("notification_preferences").$type<Record<string, boolean>>().notNull().default({}),
  theme: text("theme").notNull().default("system"),
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof usersTable.$inferSelect;
export type InsertUser = typeof usersTable.$inferInsert;
