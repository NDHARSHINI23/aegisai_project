import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const evalQuestionsTable = pgTable("eval_questions", {
  id: uuid("id").primaryKey().defaultRandom(),
  benchmark: text("benchmark").notNull(),
  subject: text("subject").notNull(),
  question: text("question").notNull(),
  context: text("context").notNull(),
  goldAnswer: text("gold_answer").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EvalQuestion = typeof evalQuestionsTable.$inferSelect;
export type InsertEvalQuestion = typeof evalQuestionsTable.$inferInsert;
