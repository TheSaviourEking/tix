import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  decimal,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  passwordHash: varchar("password_hash"),
  stripeCustomerId: varchar("stripe_customer_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const events = pgTable("events", {
  id: varchar("id").primaryKey().notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  shortDescription: varchar("short_description", { length: 500 }),
  category: varchar("category", { length: 100 }).notNull(),
  imageUrl: varchar("image_url"),
  venue: varchar("venue", { length: 255 }),
  location: varchar("location", { length: 255 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  timezone: varchar("timezone", { length: 100 }).default("UTC"),
  isVirtual: boolean("is_virtual").default(false),
  virtualLink: varchar("virtual_link"),
  maxAttendees: integer("max_attendees"),
  status: varchar("status", { length: 50 }).default("draft"), // draft, published, cancelled, completed
  organizerId: varchar("organizer_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const ticketTypes = pgTable("ticket_types", {
  id: varchar("id").primaryKey().notNull(),
  eventId: varchar("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull(),
  sold: integer("sold").default(0),
  saleStartDate: timestamp("sale_start_date"),
  saleEndDate: timestamp("sale_end_date"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookings = pgTable("bookings", {
  id: varchar("id").primaryKey().notNull(),
  eventId: varchar("event_id").notNull().references(() => events.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  ticketTypeId: varchar("ticket_type_id").notNull().references(() => ticketTypes.id),
  quantity: integer("quantity").notNull(),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).default("pending"), // pending, confirmed, cancelled, refunded
  paymentIntentId: varchar("payment_intent_id"),
  bookingReference: varchar("booking_reference", { length: 20 }).notNull().unique(),
  attendeeEmail: varchar("attendee_email"),
  attendeeName: varchar("attendee_name"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const eventCategories = pgTable("event_categories", {
  id: varchar("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  icon: varchar("icon", { length: 50 }),
  color: varchar("color", { length: 20 }),
});

// Zod schemas
export const insertUserSchema = createInsertSchema(users);
// export const insertEventSchema = createInsertSchema(events).omit({
//   createdAt: true,
//   updatedAt: true,
// });
export const insertEventSchema = createInsertSchema(events, {
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
}).omit({
  createdAt: true,
  updatedAt: true,
});
export const insertTicketTypeSchema = createInsertSchema(ticketTypes).omit({
  createdAt: true,
  sold: true,
});
export const insertBookingSchema = createInsertSchema(bookings).omit({
  createdAt: true,
  updatedAt: true,
});

// Types
export type UpsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;
export type TicketType = typeof ticketTypes.$inferSelect;
export type InsertTicketType = z.infer<typeof insertTicketTypeSchema>;
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type EventCategory = typeof eventCategories.$inferSelect;
