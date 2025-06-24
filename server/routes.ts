import type { Express } from "express";
import { createServer, type Server } from "http";
import Stripe from "stripe";
import { storage } from "./storage";
import { setupCustomAuth, isAuthenticated } from "./auth";
import session from "express-session";
import { insertEventSchema, insertTicketTypeSchema, insertBookingSchema, ticketTypes, events, bookings } from "@shared/schema";
import { z } from "zod";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq } from "drizzle-orm";
import PDFDocument from 'pdfkit';
import QRCode from 'qrcode';
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import { UploadApiResponse, UploadApiErrorResponse } from 'cloudinary';


interface AuthRequest extends express.Request {
  user: { claims: { sub: string } };
}

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('Missing required Stripe secret: STRIPE_SECRET_KEY');
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2025-05-28.basil",
});

function generateBookingReference(): string {
  return 'BK' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

// Configure Multer for handling multipart form data
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!validTypes.includes(file.mimetype)) {
      return cb(new Error('Invalid file type. Only JPEG, PNG, and GIF are allowed.'));
    }
    cb(null, true);
  },
});

// Configure Cloudinary (replace with your credentials)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  timeout: 60000,
});

// Interface for the response (matches frontend)
interface UploadImageResult {
  url: string;
  publicId: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup session middleware
  app.use(session({
    secret: process.env.SESSION_SECRET || 'fallback-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Auth middleware
  setupCustomAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Event routes
  // app.get("/api/events", async (req, res) => {
  //   try {
  //     const { category, search, location, page = 1, limit = 12, status } = req.query;
  //     const events = await storage.getEvents({
  //       category: category as string,
  //       search: search as string,
  //       location: location as string,
  //       page: Number(page),
  //       limit: Number(limit),
  //       status: status as string,
  //     });
  //     res.json(events);
  //   } catch (error) {
  //     console.error("Error fetching events:", error);
  //     res.status(500).json({ message: "Failed to fetch events" });
  //   }
  // });

  app.get("/api/events", async (req, res) => {
    console.log("Received query parameters:", req.query);
    try {
      const { category, search, location, page = 1, limit = 12, status } = req.query;
      const events = await storage.getEvents({
        category: category as string,
        search: search as string,
        location: location as string,
        page: Number(page),
        limit: Number(limit),
        status: status as string,
      });
      res.json(events);
    } catch (error) {
      console.error("Error fetching events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/events/:id", async (req, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      res.json(event);
    } catch (error) {
      console.error("Error fetching event:", error);
      res.status(500).json({ message: "Failed to fetch event" });
    }
  });

  app.post("/api/events", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertEventSchema.parse({
        ...req.body,
        organizerId: req.user.claims.sub,
        id: randomUUID(),
      });
      const event = await storage.createEvent(validatedData);
      res.status(201).json(event);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      console.error("Error creating event:", error);
      res.status(500).json({ message: "Failed to create event" });
    }
  });

  app.put("/api/events/:id", isAuthenticated, async (req: any, res) => {
    try {
      console.log(1)
      const event = await storage.getEventById(req.params.id);
      console.log(2)
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      console.log(3)
      if (event.organizerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Not authorized to update this event" });
      }
      console.log(4)
      console.log(event, 'fOUND EVNET')
      const validatedData = insertEventSchema.partial().parse(req.body);
      console.log(5)
      const updatedEvent = await storage.updateEvent(req.params.id, validatedData);
      console.log(6)
      res.json(updatedEvent);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid event data", errors: error.errors });
      }
      console.error("Error updating event:", error);
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  // Event publishing routes
  app.patch("/api/events/:id/publish", isAuthenticated, async (req: any, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.organizerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Not authorized to publish this event" });
      }

      const updatedEvent = await storage.updateEventStatus(req.params.id, "published");
      res.json(updatedEvent);
    } catch (error) {
      console.error("Error publishing event:", error);
      res.status(500).json({ message: "Failed to publish event" });
    }
  });

  app.patch("/api/events/:id/unpublish", isAuthenticated, async (req: any, res) => {
    try {
      const event = await storage.getEventById(req.params.id);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.organizerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Not authorized to unpublish this event" });
      }

      const updatedEvent = await storage.updateEventStatus(req.params.id, "draft");
      res.json(updatedEvent);
    } catch (error) {
      console.error("Error unpublishing event:", error);
      res.status(500).json({ message: "Failed to unpublish event" });
    }
  });

  // Admin routes
  app.get("/api/admin/events", isAuthenticated, async (req: any, res) => {
    try {
      // Check if user is admin (you can implement admin role checking here)
      const events = await storage.getAllEventsForAdmin();
      res.json(events);
    } catch (error) {
      console.error("Error fetching admin events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  app.get("/api/admin/stats", isAuthenticated, async (req: any, res) => {
    try {
      // Implement admin statistics
      const stats = {
        totalEvents: 0,
        totalUsers: 0,
        totalBookings: 0,
        totalRevenue: 0
      };
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // User bookings routes
  // app.get("/api/bookings", isAuthenticated, async (req: any, res) => {
  //   try {
  //     const bookings = await storage.getUserBookings(req.user.claims.sub);
  //     res.json(bookings);
  //   } catch (error) {
  //     console.error("Error fetching bookings:", error);
  //     res.status(500).json({ message: "Failed to fetch bookings" });
  //   }
  // });

  // Ticket type routes
  app.get("/api/events/:eventId/tickets", async (req, res) => {
    try {
      const tickets = await storage.getTicketTypesByEvent(req.params.eventId);
      res.json(tickets);
    } catch (error) {
      console.error("Error fetching tickets:", error);
      res.status(500).json({ message: "Failed to fetch tickets" });
    }
  });

  app.post("/api/events/:eventId/tickets", isAuthenticated, async (req: any, res) => {
    try {
      const event = await storage.getEventById(req.params.eventId);
      if (!event) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (event.organizerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Not authorized to create tickets for this event" });
      }

      const validatedData = insertTicketTypeSchema.parse({
        ...req.body,
        eventId: req.params.eventId,
        id: randomUUID(),
      });
      const ticket = await storage.createTicketType(validatedData);
      res.status(201).json(ticket);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid ticket data", errors: error.errors });
      }
      console.error("Error creating ticket:", error);
      res.status(500).json({ message: "Failed to create ticket" });
    }
  });

  // Booking routes
  // app.get("/api/bookings/:id/ticket", isAuthenticated, async (req: AuthRequest, res) => {
  //   try {
  //     const { id } = req.params;

  //     // Fetch booking details with event and ticket type
  //     const [booking] = await db
  //       .select({
  //         id: bookings.id,
  //         bookingReference: bookings.bookingReference,
  //         quantity: bookings.quantity,
  //         totalAmount: bookings.totalAmount,
  //         status: bookings.status,
  //         createdAt: bookings.createdAt,
  //         userId: bookings.user_id,
  //         event: {
  //           title: events.title,
  //           description: events.description,
  //           startDate: events.startDate,
  //           endDate: events.endDate,
  //           location: events.location,
  //           imageUrl: events.imageUrl
  //         },
  //         ticketType: {
  //           name: ticketTypes.name,
  //           price: ticketTypes.price
  //         }
  //       })
  //       .from(bookings)
  //       .leftJoin(events, eq(bookings.eventId, events.id))
  //       .leftJoin(ticketTypes, eq(bookings.ticketTypeId, ticketTypes.id))
  //       .where(eq(bookings.id, id));

  //     if (!booking) {
  //       return res.status(404).json({ message: "Booking not found" });
  //     }

  //     console.log(booking, booking.userId, req.user.claims.sub, 'USER ID AND CLAIMS SUB\n\n\n---------------');

  //     // Verify ownership
  //     if (booking.userId !== req.user.claims.sub) {
  //       return res.status(403).json({ message: "Unauthorized" });
  //     }

  //     console.log('USER ID AND CLAIMS SUB MATCHED', '\n\n\n---------------', 'Printing QR CODE');
  //     // Generate QR code for ticket verification
  //     const qrData = JSON.stringify({
  //       bookingId: booking.id,
  //       reference: booking.bookingReference,
  //       eventId: booking.event.id
  //     });

  //     const qrCodeDataURL = await QRCode.toDataURL(qrData, {
  //       width: 150,
  //       margin: 1,
  //       color: {
  //         dark: '#000000',
  //         light: '#FFFFFF'
  //       }
  //     });

  //     // Create PDF document
  //     const doc = new PDFDocument({
  //       size: 'A4',
  //       margins: { top: 50, left: 50, right: 50, bottom: 50 }
  //     });

  //     // Set response headers
  //     res.setHeader('Content-Type', 'application/pdf');
  //     res.setHeader('Content-Disposition', `attachment; filename="ticket-${booking.bookingReference}.pdf"`);

  //     // Pipe PDF to response
  //     doc.pipe(res);

  //     // Header
  //     doc.fontSize(24)
  //       .fillColor('#2563eb')
  //       .text('EVENT TICKET', 50, 50, { align: 'center' });

  //     // Event title
  //     doc.fontSize(20)
  //       .fillColor('#1f2937')
  //       .text(booking.event.title, 50, 100, { align: 'center' });

  //     // Booking reference (prominent)
  //     doc.fontSize(14)
  //       .fillColor('#6b7280')
  //       .text('Booking Reference:', 50, 150);

  //     doc.fontSize(16)
  //       .fillColor('#1f2937')
  //       .font('Helvetica-Bold')
  //       .text(booking.bookingReference, 50, 170);

  //     // Event details section
  //     doc.font('Helvetica')
  //       .fontSize(12)
  //       .fillColor('#374151');

  //     let yPosition = 220;

  //     // Date and time
  //     const startDate = new Date(booking.event.startDate);
  //     const endDate = booking.event.endDate ? new Date(booking.event.endDate) : null;

  //     doc.text('Date & Time:', 50, yPosition);
  //     doc.text(startDate.toLocaleDateString('en-US', {
  //       weekday: 'long',
  //       year: 'numeric',
  //       month: 'long',
  //       day: 'numeric'
  //     }), 150, yPosition);

  //     yPosition += 20;
  //     doc.text('Start Time:', 50, yPosition);
  //     doc.text(startDate.toLocaleTimeString('en-US', {
  //       hour: '2-digit',
  //       minute: '2-digit'
  //     }), 150, yPosition);

  //     if (endDate) {
  //       yPosition += 20;
  //       doc.text('End Time:', 50, yPosition);
  //       doc.text(endDate.toLocaleTimeString('en-US', {
  //         hour: '2-digit',
  //         minute: '2-digit'
  //       }), 150, yPosition);
  //     }

  //     // Location
  //     yPosition += 30;
  //     doc.text('Location:', 50, yPosition);
  //     doc.text(booking.event.location, 150, yPosition, { width: 300 });

  //     // Ticket details
  //     yPosition += 50;
  //     doc.fontSize(14)
  //       .fillColor('#1f2937')
  //       .text('Ticket Details', 50, yPosition);

  //     yPosition += 25;
  //     doc.fontSize(12)
  //       .fillColor('#374151');

  //     doc.text('Ticket Type:', 50, yPosition);
  //     doc.text(booking.ticketType.name, 150, yPosition);

  //     yPosition += 20;
  //     doc.text('Quantity:', 50, yPosition);
  //     doc.text(`${booking.quantity} ticket(s)`, 150, yPosition);

  //     yPosition += 20;
  //     doc.text('Total Amount:', 50, yPosition);
  //     doc.text(`$${booking.totalAmount}`, 150, yPosition);

  //     yPosition += 20;
  //     doc.text('Status:', 50, yPosition);
  //     doc.fillColor(booking.status === 'confirmed' ? '#059669' : '#d97706')
  //       .text(booking.status.toUpperCase(), 150, yPosition);

  //     // QR Code
  //     const qrBuffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');
  //     doc.image(qrBuffer, 400, 200, { width: 120, height: 120 });

  //     doc.fillColor('#6b7280')
  //       .fontSize(10)
  //       .text('Scan for verification', 420, 330, { align: 'center', width: 80 });

  //     // Footer
  //     doc.fillColor('#9ca3af')
  //       .fontSize(10)
  //       .text('Please bring this ticket and a valid ID to the event.', 50, 700, { align: 'center' });

  //     doc.text('For support, contact: support@usetix.com', 50, 715, { align: 'center' });

  //     // Add a border around the entire ticket
  //     doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
  //       .stroke('#e5e7eb');

  //     // Finalize PDF
  //     doc.end();

  //   } catch (error) {
  //     console.error('Error generating ticket:', error);
  //     res.status(500).json({ message: "Failed to generate ticket" });
  //   }
  // });

  app.get("/api/bookings/:id/ticket", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;

      // Fetch booking details with event and ticket type
      const [booking] = await db
        .select({
          id: bookings.id,
          bookingReference: bookings.bookingReference,
          quantity: bookings.quantity,
          totalAmount: bookings.totalAmount,
          status: bookings.status,
          createdAt: bookings.createdAt,
          userId: bookings.userId,
          event: {
            id: events.id, // Added for QR code
            title: events.title,
            description: events.description,
            startDate: events.startDate,
            endDate: events.endDate,
            location: events.location,
            imageUrl: events.imageUrl,
          },
          ticketType: {
            name: ticketTypes.name,
            price: ticketTypes.price,
          },
        })
        .from(bookings)
        .leftJoin(events, eq(bookings.eventId, events.id))
        .leftJoin(ticketTypes, eq(bookings.ticketTypeId, ticketTypes.id))
        .where(eq(bookings.id, id));

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      // Verify ownership
      if (booking.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "You are not authorized to access this booking" });
      }

      // Ensure booking is confirmed
      if (booking.status !== 'confirmed') {
        return res.status(400).json({ message: "Cannot download ticket for unconfirmed booking" });
      }

      // Generate QR code for ticket verification
      const qrData = JSON.stringify({
        bookingId: booking.id,
        reference: booking.bookingReference,
        eventId: booking.event.id, // Now valid
      });

      const qrCodeDataURL = await QRCode.toDataURL(qrData, {
        width: 150,
        margin: 1,
        color: { dark: '#000000', light: '#FFFFFF' },
      });

      // Create PDF document
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, left: 50, right: 50, bottom: 50 },
      });

      // Set response headers
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="ticket-${booking.bookingReference}.pdf"`);

      // Pipe PDF to response
      doc.pipe(res);

      // Header with branding
      doc.fontSize(24)
        .fillColor('#2563eb')
        .text('Tix Ticket', 50, 50, { align: 'center' });

      // Event image (if available)
      if (booking.event.imageUrl) {
        try {
          const imageResponse = await fetch(booking.event.imageUrl);
          const imageBuffer = await imageResponse.buffer();
          doc.image(imageBuffer, 50, 80, { width: 200, height: 100, align: 'center' });
        } catch (error) {
          console.warn('Failed to load event image:', error);
        }
      }

      // Event title
      doc.fontSize(20)
        .fillColor('#1f2937')
        .text(booking.event.title, 50, 200, { align: 'center' });

      // Booking reference
      doc.fontSize(14)
        .fillColor('#6b7280')
        .text('Booking Reference:', 50, 250);
      doc.fontSize(16)
        .fillColor('#1f2937')
        .font('Helvetica-Bold')
        .text(booking.bookingReference, 50, 270);

      // Event details
      doc.font('Helvetica')
        .fontSize(12)
        .fillColor('#374151');

      let yPosition = 320;

      // Date and time
      const startDate = new Date(booking.event.startDate);
      const endDate = booking.event.endDate ? new Date(booking.event.endDate) : null;

      doc.text('Date:', 50, yPosition);
      doc.text(
        startDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        150,
        yPosition
      );

      yPosition += 20;
      doc.text('Start Time:', 50, yPosition);
      doc.text(
        startDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        150,
        yPosition
      );

      if (endDate) {
        yPosition += 20;
        doc.text('End Time:', 50, yPosition);
        doc.text(
          endDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
          150,
          yPosition
        );
      }

      // Location
      yPosition += 30;
      doc.text('Location:', 50, yPosition);
      doc.text(booking.event.location, 150, yPosition, { width: 300 });

      // Ticket details
      yPosition += 50;
      doc.fontSize(14).fillColor('#1f2937').text('Ticket Details', 50, yPosition);

      yPosition += 25;
      doc.fontSize(12).fillColor('#374151');

      doc.text('Ticket Type:', 50, yPosition);
      doc.text(booking.ticketType.name, 150, yPosition);

      yPosition += 20;
      doc.text('Quantity:', 50, yPosition);
      doc.text(`${booking.quantity} ticket(s)`, 150, yPosition);

      yPosition += 20;
      doc.text('Total Amount:', 50, yPosition);
      doc.text(`$${booking.totalAmount}`, 150, yPosition);

      yPosition += 20;
      doc.text('Status:', 50, yPosition);
      doc.fillColor(booking.status === 'confirmed' ? '#059669' : '#d97706')
        .text(booking.status.toUpperCase(), 150, yPosition);

      // QR Code
      const qrBuffer = Buffer.from(qrCodeDataURL.split(',')[1], 'base64');
      doc.image(qrBuffer, 400, 200, { width: 120, height: 120 });
      doc.fillColor('#6b7280')
        .fontSize(10)
        .text('Scan for verification', 400, 330, { align: 'center', width: 120 });

      // Footer
      doc.fillColor('#9ca3af')
        .fontSize(10)
        .text('Please bring this ticket and a valid ID to the event.', 50, 700, { align: 'center' });
      doc.text('For support, contact: support@usetix.com', 50, 715, { align: 'center' });

      // Border
      doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60).stroke('#e5e7eb');

      // Finalize PDF
      doc.end();

    } catch (error) {
      console.error('Error generating ticket:', error);
      res.status(500).json({ message: 'Failed to generate ticket' });
    }
  });

  app.get('/api/bookings/:id', isAuthenticated, async (req: any, res) => {
    try {
      const booking = await storage.getBookingById(req.params.id);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (booking.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Not authorized" });
      }
      res.json(booking);
    } catch (error) {
      console.error("Error fetching booking:", error);
      res.status(500).json({ message: "Failed to fetch booking" });
    }
  });

  app.post("/api/bookings", isAuthenticated, async (req: any, res) => {
    try {
      const validatedData = insertBookingSchema.parse({
        ...req.body,
        userId: req.user.claims.sub,
        bookingReference: generateBookingReference(),
        status: "pending",
        id: randomUUID(),
      });

      // Check ticket availability
      const ticketType = await storage.getTicketTypeById(validatedData.ticketTypeId);
      if (!ticketType) {
        return res.status(404).json({ message: "Ticket type not found" });
      }
      if ((ticketType.sold || 0) + validatedData.quantity > ticketType.quantity) {
        return res.status(400).json({ message: "Not enough tickets available" });
      }

      const booking = await storage.createBooking(validatedData);
      res.status(201).json(booking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid booking data", errors: error.errors });
      }
      console.error("Error creating booking:", error);
      res.status(500).json({ message: "Failed to create booking" });
    }
  });

  app.get("/api/bookings", isAuthenticated, async (req: any, res) => {
    try {
      const bookings = await storage.getUserBookings(req.user.claims.sub);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  // Update event
  // app.patch("/api/events/:id", isAuthenticated, async (req: AuthRequest, res) => {
  //   try {
  //     const { id } = req.params;
  //     const payload = req.body;
  //     const [event] = await db
  //       .update(events)
  //       .set({
  //         ...payload,
  //         updatedAt: new Date(),
  //       })
  //       .where(eq(events.id, id))
  //       .returning();
  //     if (!event || event.organizerId !== req.user.claims.sub) {
  //       return res.status(404).json({ message: "Event not found or unauthorized" });
  //     }
  //     res.json(event);
  //   } catch (error) {
  //     res.status(500).json({ message: "Failed to update event" });
  //   }
  // });

  // Update ticket
  app.patch("/api/tickets/:id", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const payload = req.body;
      const [ticket] = await db
        .update(ticketTypes)
        .set({
          ...payload,
          updatedAt: new Date(),
        })
        .where(eq(ticketTypes.id, id))
        .returning();

      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }

      const [event] = await db
        .select()
        .from(events)
        .where(eq(events.id, ticket.eventId));
      if (event.organizerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ message: "Failed to update ticket" });
    }
  });

  // Delete ticket
  app.delete("/api/tickets/:id", isAuthenticated, async (req: AuthRequest, res) => {
    try {
      const { id } = req.params;
      const [ticket] = await db
        .delete(ticketTypes)
        .where(eq(ticketTypes.id, id))
        .returning();
      if (!ticket) {
        return res.status(404).json({ message: "Ticket not found" });
      }
      const [event] = await db
        .select()
        .from(events)
        .where(eq(events.id, ticket.eventId));
      if (event.organizerId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Unauthorized" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete ticket" });
    }
  });

  // Payment routes
  app.post("/api/create-payment-intent", isAuthenticated, async (req: any, res) => {
    try {
      const { bookingId } = req.body;

      const booking = await storage.getBookingById(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }
      if (booking.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(parseFloat(booking.totalAmount) * 100), // Convert to cents
        currency: "usd",
        metadata: {
          bookingId: booking.id,
          userId: booking.userId,
        },
      });

      await storage.updateBooking(bookingId, {
        paymentIntentId: paymentIntent.id
      });

      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (error: any) {
      console.error("Error creating payment intent:", error);
      res.status(500).json({ message: "Error creating payment intent: " + error.message });
    }
  });

  app.post("/api/payment-success", isAuthenticated, async (req: any, res) => {
    try {
      const { paymentIntentId } = req.body;

      const booking = await storage.getBookingByPaymentIntent(paymentIntentId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      await storage.updateBooking(booking.id, { status: "confirmed" });
      await storage.updateTicketSold(booking.ticketTypeId, booking.quantity);

      res.json({ message: "Payment confirmed", booking });
    } catch (error) {
      console.error("Error confirming payment:", error);
      res.status(500).json({ message: "Failed to confirm payment" });
    }
  });

  // Dashboard routes
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const stats = await storage.getDashboardStats(req.user.claims.sub);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  app.get("/api/dashboard/events", isAuthenticated, async (req: any, res) => {
    try {
      const events = await storage.getOrganizerEvents(req.user.claims.sub);
      res.json(events);
    } catch (error) {
      console.error("Error fetching organizer events:", error);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // Categories route
  app.get("/api/categories", async (req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // POST /api/upload-image
  // app.post('/upload-image', upload.single('image'), async (req: Request, res: Response) => {
  app.post('/api/upload-image', upload.single('image'), async (req: any, res) => {
    console.log('uploading image')
    try {
      console.log(1)
      if (!req.file) {
        console.error('Upload error: No file provided');
        return res.status(400).json({ message: 'No image file provided' });
      }
      console.log(2)
      // Upload to Cloudinary using buffer
      const result: UploadApiResponse = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'events',
            resource_type: 'image',
            timeout: 60000, // 60 seconds
          },
          (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              return reject(new Error('Failed to upload image to Cloudinary'));
            }
            if (!result) {
              console.error('Cloudinary upload error: No result returned');
              return reject(new Error('No result from Cloudinary'));
            }
            resolve(result);
          }
        );

        uploadStream.on('error', (error) => {
          console.error('Upload stream error:', error);
          reject(error);
        });

        uploadStream.end(req.file!.buffer);
      });


      console.log(3)
      const response: UploadImageResult = {
        url: result.secure_url,
        publicId: result.public_id,
      };

      console.log(4)
      console.log('Image uploaded successfully:', {
        url: response.url,
        publicId: response.publicId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      });

      console.log(5)

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Upload endpoint error:', {
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ message: error.message || 'Failed to upload image' });
    }
  });

  app.post('/api/upload-profile-image', upload.single('profileImage'), async (req: any, res) => {
    console.log('uploading profile image');
    try {
      if (!req.file) {
        console.error('Upload error: No file provided');
        return res.status(400).json({ message: 'No profile image file provided' });
      }

      // Upload to Cloudinary using buffer
      const result: UploadApiResponse = await new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          {
            folder: 'tix-profile-images',
            resource_type: 'image',
            timeout: 60000, // 60 seconds
          },
          (error: UploadApiErrorResponse | undefined, result: UploadApiResponse | undefined) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              return reject(new Error('Failed to upload profile image to Cloudinary'));
            }
            if (!result) {
              console.error('Cloudinary upload error: No result returned');
              return reject(new Error('No result from Cloudinary'));
            }
            resolve(result);
          }
        );

        uploadStream.on('error', (error) => {
          console.error('Upload stream error:', error);
          reject(error);
        });

        uploadStream.end(req.file!.buffer);
      });

      const response: UploadImageResult = {
        url: result.secure_url,
        publicId: result.public_id,
      };

      // const response = {
      //   url: 'https://res.cloudinary.com/dvh58eqak/image/upload/v1750754229/tix-profile-images/ij4majnsgdbss9m740kf.png',
      //   publicId: 'tix-profile-images/ij4majnsgdbss9m740kf',
      //   fileName: 'Screenshot From 2025-05-17 14-23-16.png',
      //   fileSize: 28711
      // }

      console.log('Profile image uploaded successfully:', {
        url: response.url,
        publicId: response.publicId,
        fileName: req.file.originalname,
        fileSize: req.file.size,
      });

      res.status(200).json(response);
    } catch (error: any) {
      console.error('Profile upload endpoint error:', {
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ message: error.message || 'Failed to upload profile image' });
    }
  });

  // Optional: DELETE /api/delete-image/:publicId
  app.delete('/delete-image/:publicId', async (req: Request, res: Response) => {
    try {
      const { publicId } = req.params;

      if (!publicId) {
        console.error('Delete error: No publicId provided');
        return res.status(400).json({ message: 'Public ID is required' });
      }

      const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });

      if (result.result !== 'ok') {
        console.error('Cloudinary delete error:', result);
        return res.status(400).json({ message: 'Failed to delete image from Cloudinary' });
      }

      console.log('Image deleted successfully:', { publicId });
      res.status(200).json({ message: 'Image deleted successfully' });
    } catch (error: any) {
      console.error('Delete endpoint error:', {
        message: error.message,
        stack: error.stack,
      });
      res.status(500).json({ message: 'Failed to delete image' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
