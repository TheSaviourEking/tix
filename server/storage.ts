import {
  users,
  events,
  ticketTypes,
  bookings,
  eventCategories,
  type User,
  type UpsertUser,
  type Event,
  type InsertEvent,
  type TicketType,
  type InsertTicketType,
  type Booking,
  type InsertBooking,
  type EventCategory,
} from "@shared/schema";
import { db } from "./db";
import { eq, and, ilike, and, gte, lte, desc, sql, count, sum, InferSelectModel } from "drizzle-orm";

interface GetEventsFilters {
  category?: string;
  search?: string;
  location?: string;
  page?: number;
  limit?: number;
  status?: string;
}

interface EventWithTickets extends Event {
  ticketTypes: Array<{ name: string; price: string }>;
  attendeeCount: number;
}

// Define the expected type for ticketTypes
type TicketType = {
  name: string;
  price: string;
};

// Extend the Event type with additional field
interface EventWithTickets extends Event {
  ticketTypes: TicketType[];
  attendeeCount: number;
}

// Infer the base event type from the schema
// type EventSelect = InferSelectModel<typeof events>;

interface GetEventsFilters {
  category?: string;
  search?: string;
  location?: string;
  page?: number;
  limit?: number;
  status?: string;
}

// Interface for storage operations
export interface IStorage {
  // User operations
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  createUser(user: UpsertUser): Promise<User>;

  // Event operations
  getEvents(filters: {
    category?: string;
    search?: string;
    location?: string;
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ events: Event[]; total: number }>;
  getEventById(id: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event>;
  updateEventStatus(id: string, status: string): Promise<Event>;
  getOrganizerEvents(organizerId: string): Promise<Event[]>;
  getAllEventsForAdmin(): Promise<Event[]>;

  // Ticket operations
  getTicketTypesByEvent(eventId: string): Promise<TicketType[]>;
  getTicketTypeById(id: string): Promise<TicketType | undefined>;
  createTicketType(ticket: InsertTicketType): Promise<TicketType>;
  updateTicketSold(ticketTypeId: string, quantity: number): Promise<void>;

  // Booking operations
  getUserBookings(userId: string): Promise<Booking[]>;
  getBookingById(id: string): Promise<Booking | undefined>;
  getBookingByPaymentIntent(paymentIntentId: string): Promise<Booking | undefined>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: string, booking: Partial<InsertBooking>): Promise<Booking>;

  // Dashboard operations
  getDashboardStats(organizerId: string): Promise<{
    totalEvents: number;
    totalRevenue: string;
    totalAttendees: number;
    avgRating: string;
  }>;

  // Category operations
  getCategories(): Promise<EventCategory[]>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Event operations
  // async getEvents(filters: {
  //   category?: string;
  //   search?: string;
  //   location?: string;
  //   page?: number;
  //   limit?: number;
  //   status?: string;
  // }): Promise<{ events: Event[]; total: number }> {
  //   const page = filters.page || 1;
  //   const limit = filters.limit || 12;
  //   const conditions = [];

  //   if (filters.category) {
  //     conditions.push(eq(events.category, filters.category));
  //   }

  //   if (filters.search) {
  //     conditions.push(ilike(events.title, `%${filters.search}%`));
  //   }

  //   if (filters.location) {
  //     conditions.push(ilike(events.location, `%${filters.location}%`));
  //   }

  //   // Add condition to only show published events
  //   conditions.push(eq(events.status, "published"));

  //   const offset = (page - 1) * limit;

  //   const [eventsResult, totalResult] = await Promise.all([
  //     db
  //       .select()
  //       .from(events)
  //       .where(and(...conditions))
  //       .orderBy(desc(events.startDate))
  //       .limit(limit)
  //       .offset(offset),
  //     // db
  //     //   .select({
  //     //     event: events,
  //     //     ticketTypes: ticketTypes,
  //     //   })
  //     //   .from(events)
  //     //   .leftJoin(ticketTypes, eq(events.id, ticketTypes.event_id))
  //     //   .where(and(...conditions))
  //     //   .orderBy(desc(events.startDate))
  //     //   .limit(limit)
  //     //   .offset(offset),

  //     // db
  //     //   .select({
  //     //     eventId: events.id,
  //     //     event: events,
  //     //     ticketType: ticketTypes,
  //     //   })
  //     //   .from(events)
  //     //   .leftJoin(ticketTypes, eq(events.id, ticketTypes.event_id))
  //     //   .where(and(...conditions))
  //     //   .orderBy(desc(events.startDate))
  //     //   .limit(limit)
  //     //   .offset(offset),
  //     db
  //       .select({ count: count() })
  //       .from(events)
  //       .where(and(...conditions))
  //   ]);

  //   return {
  //     events: eventsResult,
  //     total: totalResult[0]?.count || 0,
  //   };
  // }

  // async getEvents(filters: GetEventsFilters): Promise<{ events: EventWithTickets[]; total: number }> {
  //   const page = filters.page || 1;
  //   const limit = filters.limit || 12;
  //   const conditions = [];

  //   if (filters.category) {
  //     conditions.push(eq(events.category, filters.category));
  //   }

  //   if (filters.search) {
  //     conditions.push(ilike(events.title, `%${filters.search}%`));
  //   }

  //   if (filters.location) {
  //     conditions.push(ilike(events.location, `%${filters.location}%`));
  //   }

  //   // Add condition to only show published events
  //   conditions.push(eq(events.status, 'published'));

  //   const offset = (page - 1) * limit;

  //   const [eventsResult, totalResult] = await Promise.all([
  //     db
  //       .select({
  //         id: events.id,
  //         title: events.title,
  //         description: events.description,
  //         shortDescription: events.shortDescription,
  //         category: events.category,
  //         imageUrl: events.imageUrl,
  //         venue: events.venue,
  //         location: events.location,
  //         startDate: events.startDate,
  //         endDate: events.endDate,
  //         timezone: events.timezone,
  //         isVirtual: events.isVirtual,
  //         virtualLink: events.virtualLink,
  //         maxAttendees: events.maxAttendees,
  //         status: events.status,
  //         organizerId: events.organizerId,
  //         createdAt: events.createdAt,
  //         updatedAt: events.updatedAt,
  //         ticketTypes: sql<TicketType[]>`
  //         COALESCE(
  //           json_agg(
  //             json_build_object(
  //               'name', ${ticketTypes.name},
  //               'price', CAST(${ticketTypes.price} AS TEXT)
  //             )
  //           ) FILTER (WHERE ${ticketTypes.id} IS NOT NULL),
  //           '[]'::json
  //         )
  //       `.as('ticketTypes'),
  //         attendeeCount: sql<number>`
  //         COALESCE(SUM(${ticketTypes.sold}), 0)::INTEGER
  //       `.as('attendeeCount'),
  //       })
  //       .from(events)
  //       .leftJoin(ticketTypes, eq(events.id, ticketTypes.eventId))
  //       .where(and(...conditions))
  //       .groupBy(events.id)
  //       .orderBy(desc(events.startDate))
  //       .limit(limit)
  //       .offset(offset),
  //     db
  //       .select({ count: count() })
  //       .from(events)
  //       .where(and(...conditions)),
  //   ]);

  //   return {
  //     events: eventsResult,
  //     total: totalResult[0]?.count || 0,
  //   };
  // }

  async getEvents(filters: GetEventsFilters): Promise<{ events: EventWithTickets[]; total: number }> {
    const page = filters.page || 1;
    const limit = filters.limit || 12;
    const conditions = [];

    if (filters.category && filters.category !== "all") {
      conditions.push(eq(events.category, filters.category));
    }
    if (filters.search) conditions.push(ilike(events.title, `%${filters.search}%`));
    if (filters.location) conditions.push(ilike(events.location, `%${filters.location}%`));
    if (filters.startDate) conditions.push(gte(events.startDate, new Date(filters.startDate)));
    if (filters.endDate) conditions.push(lte(events.endDate, new Date(filters.endDate)));
    conditions.push(eq(events.status, "published"));

    const offset = (page - 1) * limit;

    const [eventsResult, totalResult] = await Promise.all([
      db
        .select({
          id: events.id,
          title: events.title,
          description: events.description,
          shortDescription: events.shortDescription,
          category: events.category,
          imageUrl: events.imageUrl,
          venue: events.venue,
          location: events.location,
          startDate: events.startDate,
          endDate: events.endDate,
          timezone: events.timezone,
          isVirtual: events.isVirtual,
          virtualLink: events.virtualLink,
          maxAttendees: events.maxAttendees,
          status: events.status,
          organizerId: events.organizerId,
          createdAt: events.createdAt,
          updatedAt: events.updatedAt,
          ticketTypes: sql<TicketType[]>`
          COALESCE(
            json_agg(
              json_build_object(
                'name', ${ticketTypes.name},
                'price', CAST(${ticketTypes.price} AS TEXT)
              )
            ) FILTER (WHERE ${ticketTypes.id} IS NOT NULL),
            '[]'::json
          )
        `.as("ticketTypes"),
          attendeeCount: sql<number>`
          COALESCE(SUM(${ticketTypes.sold}), 0)::INTEGER
        `.as("attendeeCount"),
        })
        .from(events)
        .leftJoin(ticketTypes, eq(events.id, ticketTypes.eventId))
        .where(and(...conditions))
        .groupBy(events.id)
        .orderBy(desc(events.startDate))
        .limit(limit)
        .offset(offset),
      db
        .select({ count: count() })
        .from(events)
        .where(and(...conditions)),
    ]);

    return {
      events: eventsResult,
      total: totalResult[0]?.count || 0,
    };
  }

  async getEventById(id: string): Promise<Event | undefined> {
    const [event] = await db.select().from(events).where(eq(events.id, id));
    return event;
  }

  async createEvent(event: InsertEvent): Promise<Event> {
    const [newEvent] = await db
      .insert(events)
      .values(event)
      .returning();
    return newEvent;
  }

  async updateEvent(id: string, event: Partial<InsertEvent>): Promise<Event> {
    const [updatedEvent] = await db
      .update(events)
      .set({ ...event, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return updatedEvent;
  }

  async updateEventStatus(id: string, status: string): Promise<Event> {
    const [updatedEvent] = await db
      .update(events)
      .set({ status, updatedAt: new Date() })
      .where(eq(events.id, id))
      .returning();
    return updatedEvent;
  }

  async getAllEventsForAdmin(): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .orderBy(desc(events.createdAt));
  }

  async getOrganizerEvents(organizerId: string): Promise<Event[]> {
    return await db
      .select()
      .from(events)
      .where(eq(events.organizerId, organizerId))
      .orderBy(desc(events.createdAt));
  }

  // Ticket operations
  async getTicketTypesByEvent(eventId: string): Promise<TicketType[]> {
    return await db
      .select()
      .from(ticketTypes)
      .where(and(eq(ticketTypes.eventId, eventId), eq(ticketTypes.isActive, true)))
      .orderBy(ticketTypes.price);
  }

  async getTicketTypeById(id: string): Promise<TicketType | undefined> {
    const [ticket] = await db
      .select()
      .from(ticketTypes)
      .where(eq(ticketTypes.id, id));
    return ticket;
  }

  async createTicketType(ticket: InsertTicketType): Promise<TicketType> {
    const [newTicket] = await db
      .insert(ticketTypes)
      .values(ticket)
      .returning();
    return newTicket;
  }

  async updateTicketSold(ticketTypeId: string, quantity: number): Promise<void> {
    await db
      .update(ticketTypes)
      .set({ sold: sql`${ticketTypes.sold} + ${quantity}` })
      .where(eq(ticketTypes.id, ticketTypeId));
  }

  // Booking operations
  // async getUserBookings(userId: string): Promise<Booking[]> {
  //   return await db
  //     .select()
  //     .from(bookings)
  //     .where(eq(bookings.userId, userId))
  //     .orderBy(desc(bookings.createdAt));
  // }

  async getUserBookings(userId: string): Promise<Booking[]> {
    const result = await db
      .select({
        id: bookings.id,
        event_id: bookings.eventId, // This creates an alias 'event_id'
        quantity: bookings.quantity,
        total_amount: bookings.totalAmount,
        status: bookings.status,
        booking_reference: bookings.bookingReference,
        attendee_email: bookings.attendeeEmail,
        attendee_name: bookings.attendeeName,
        event_title: events.title,
        event_start_date: events.startDate,
        event_location: events.location,
        event_image_url: events.imageUrl,
        ticket_type_name: ticketTypes.name,
        ticket_type_price: ticketTypes.price,
      })
      .from(bookings)
      .innerJoin(events, eq(bookings.eventId, events.id))
      .innerJoin(ticketTypes, eq(bookings.ticketTypeId, ticketTypes.id))
      .where(eq(bookings.userId, userId))
      .orderBy(desc(bookings.createdAt));

    // Map to match frontend expectations
    return result.map(row => ({
      id: row.id,
      event_id: row.event_id, // This now correctly references the alias
      event: {
        title: row.event_title,
        start_date: row.event_start_date.toISOString(),
        location: row.event_location,
        image_url: row.event_image_url,
      },
      ticket_type: {
        name: row.ticket_type_name,
        price: Number(row.ticket_type_price).toFixed(2),
      },
      quantity: row.quantity,
      total_amount: Number(row.total_amount).toFixed(2),
      booking_reference: row.booking_reference,
      status: row.status as "confirmed" | "pending" | "cancelled",
      attendee_email: row.attendee_email,
      attendee_name: row.attendee_name,
    }));
  }

  // async getBookingById(id: string): Promise<Booking | undefined> {
  //   const [booking] = await db
  //     .select()
  //     .from(bookings)
  //     .where(eq(bookings.id, id));
  //   return booking;
  // }

  async getBookingById(id: string): Promise<Booking | undefined> {
    const [booking] = await db
      .select({
        // Booking fields
        // id: bookings.id,
        // eventId: bookings.eventId,
        // userId: bookings.userId,
        // ticketTypeId: bookings.ticketTypeId,
        // quantity: bookings.quantity,
        // totalAmount: bookings.totalAmount,
        // status: bookings.status,
        // paymentIntentId: bookings.paymentIntentId,
        // bookingReference: bookings.bookingReference,
        // attendeeEmail: bookings.attendeeEmail,
        // attendeeName: bookings.attendee_name || bookings.attendeeName,
        // createdAt: bookings.createdAt,
        // updatedAt: bookings.updatedAt,
        ...bookings,

        // Event fields (nested object)
        event: {
          id: events.id,
          title: events.title,
          startDate: events.startDate,
          endDate: events.endDate,
          location: events.location,
          isVirtual: events.isVirtual,
          description: events.description,
          // Add other event fields you need
        },

        // Ticket type fields (nested object)
        ticketType: {
          id: ticketTypes.id,
          name: ticketTypes.name,
          price: ticketTypes.price,
          description: ticketTypes.description,
          // Add other ticket type fields you need
        }
      })
      .from(bookings)
      .innerJoin(events, eq(bookings.eventId, events.id))
      .innerJoin(ticketTypes, eq(bookings.ticketTypeId, ticketTypes.id))
      .where(eq(bookings.id, id));

    console.log('Booking retrieved:', booking);
    return booking;
  }

  async getBookingByPaymentIntent(paymentIntentId: string): Promise<Booking | undefined> {
    const [booking] = await db
      .select()
      .from(bookings)
      .where(eq(bookings.paymentIntentId, paymentIntentId));
    return booking;
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [newBooking] = await db
      .insert(bookings)
      .values([booking])
      .returning();
    return newBooking;
  }

  async updateBooking(id: string, booking: Partial<InsertBooking>): Promise<Booking> {
    const [updatedBooking] = await db
      .update(bookings)
      .set({ ...booking, updatedAt: new Date() })
      .where(eq(bookings.id, id))
      .returning();
    return updatedBooking;
  }

  // Dashboard operations
  async getDashboardStats(organizerId: string): Promise<{
    totalEvents: number;
    totalRevenue: string;
    totalAttendees: number;
    avgRating: string;
  }> {
    const [stats] = await db
      .select({
        totalEvents: count(events.id),
        totalRevenue: sum(bookings.totalAmount),
      })
      .from(events)
      .leftJoin(bookings, eq(events.id, bookings.eventId))
      .where(eq(events.organizerId, organizerId));

    const [attendeeStats] = await db
      .select({
        totalAttendees: sum(bookings.quantity),
      })
      .from(events)
      .leftJoin(bookings, and(
        eq(events.id, bookings.eventId),
        eq(bookings.status, "confirmed")
      ))
      .where(eq(events.organizerId, organizerId));

    return {
      totalEvents: Number(stats.totalEvents) || 0,
      totalRevenue: String(stats.totalRevenue) || "0.00",
      totalAttendees: Number(attendeeStats.totalAttendees) || 0,
      avgRating: "N/A", // Would need a ratings table to implement this
    };
  }

  // Category operations
  async getCategories(): Promise<EventCategory[]> {
    return await db.select().from(eventCategories);
  }
}

export const storage = new DatabaseStorage();