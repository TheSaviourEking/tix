import { useState } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CalendarDays, MapPin, Clock, Users, Share, Heart, ExternalLink } from "lucide-react";
import { Link } from "wouter";
import type { TicketType } from "@shared/schema";

export default function EventDetails() {
  const { id } = useParams();
  const { user, isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedTicket, setSelectedTicket] = useState<string>("");
  const [quantity, setQuantity] = useState(1);

  const { data: event, isLoading: eventLoading } = useQuery({
    queryKey: [`/api/events/${id}`],
    enabled: !!id,
  });

  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: [`/api/events/${id}/tickets`],
    enabled: !!id,
  });

  const { data: userFavorites = [], isLoading: favoritesLoading } = useQuery({
    queryKey: ["/api/users/favorites"],
    queryFn: async () => {
      if (!isAuthenticated) return [];
      const response = await apiRequest("GET", "/api/users/favorites");
      return await response.json();
    },
    enabled: !!isAuthenticated && !!id,
  });

  const isEventSaved = userFavorites.includes(id);

  const saveEventMutation = useMutation({
    mutationFn: async () => {
      const method = isEventSaved ? "DELETE" : "POST";
      const response = await apiRequest(method, "/api/users/favorites", { eventId: id });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users/favorites"] });
      toast({
        title: isEventSaved ? "Event unsaved" : "Event saved",
        description: isEventSaved ? "Removed from your favorites." : "Added to your favorites.",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: `Failed to ${isEventSaved ? "unsave" : "save"} event: ${error.message}`,
        variant: "destructive",
      });
    },
  });

  const bookingMutation = useMutation({
    mutationFn: async (bookingData: any) => {
      const response = await apiRequest("POST", "/api/bookings", bookingData);
      return await response.json();
    },
    onSuccess: (booking) => {
      toast({
        title: "Booking created!",
        description: "Proceed to payment to complete your booking.",
      });
      window.location.href = `/checkout/${booking.id}`;
    },
    onError: (error) => {
      toast({
        title: "Booking failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleShare = async () => {
    const shareData = {
      title: event.title,
      text: event.shortDescription || event.description,
      url: window.location.href,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
        toast({
          title: "Shared!",
          description: "Event shared successfully.",
        });
      } else {
        await navigator.clipboard.writeText(shareData.url);
        toast({
          title: "Link copied!",
          description: "Event link copied to clipboard.",
        });
      }
    } catch (error) {
      toast({
        title: "Sharing failed",
        description: "Unable to share the event. Please try copying the link manually.",
        variant: "destructive",
      });
    }
  };

  const handleSave = () => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication required",
        description: "Please log in to save events.",
      });
      window.location.href = "/login";
      return;
    }

    saveEventMutation.mutate();
  };

  if (eventLoading || ticketsLoading || favoritesLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-64 md:h-96 bg-gray-300 rounded-2xl mb-8"></div>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <div className="h-8 bg-gray-300 rounded w-3/4"></div>
                <div className="h-4 bg-gray-300 rounded w-1/2"></div>
                <div className="space-y-3">
                  <div className="h-4 bg-gray-300 rounded"></div>
                  <div className="h-4 bg-gray-300 rounded"></div>
                  <div className="h-4 bg-gray-300 rounded w-3/4"></div>
                </div>
              </div>
              <div className="space-y-4">
                <div className="h-64 bg-gray-300 rounded-xl"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Event Not Found</h2>
          <p className="text-gray-600 mb-4">The event you're looking for doesn't exist.</p>
          <Link href="/events">
            <Button>Browse Events</Button>
          </Link>
        </div>
      </div>
    );
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleBooking = () => {
    if (!isAuthenticated) {
      toast({
        title: "Authentication required",
        description: "Please log in to book tickets.",
      });
      window.location.href = "/login";
      return;
    }

    if (!selectedTicket) {
      toast({
        title: "Select a ticket",
        description: "Please select a ticket type to continue.",
        variant: "destructive",
      });
      return;
    }

    const ticket = tickets.find((t: TicketType) => t.id === selectedTicket);
    if (!ticket) return;

    const totalAmount = parseFloat(ticket.price) * quantity;

    bookingMutation.mutate({
      eventId: event.id,
      ticketTypeId: selectedTicket,
      quantity,
      totalAmount: totalAmount.toString(),
      attendeeEmail: user?.email,
      attendeeName: `${user?.firstName} ${user?.lastName}`.trim(),
    });
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      music: "bg-pink-100 text-pink-700",
      tech: "bg-blue-100 text-blue-700",
      business: "bg-purple-100 text-purple-700",
      fitness: "bg-green-100 text-green-700",
      food: "bg-yellow-100 text-yellow-700",
      education: "bg-indigo--lea100 text-indigo-700",
      arts: "bg-pink-100 text-pink-700",
      nature: "bg-green-100 text-green-700",
    };
    return colors[category.toLowerCase()] || "bg-gray-100 text-gray-700";
  };

  const freeTickets = tickets.filter((t: TicketType) => parseFloat(t.price) === 0);
  const paidTickets = tickets.filter((t: TicketType) => parseFloat(t.price) > 0);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Image */}
      <div className="relative h-64 md:h-96 overflow-hidden">
        <img
          src={event.imageUrl || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1200&h=600&fit=crop"}
          alt={event.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black bg-opacity-40"></div>
        <div className="absolute bottom-6 left-6">
          <Badge className={getCategoryColor(event.category)}>
            {event.category}
          </Badge>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Event Header */}
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {event.title}
              </h1>
              <div className="flex flex-wrap gap-4 text-gray-600 mb-6">
                <div className="flex items-center">
                  <CalendarDays className="w-5 h-5 mr-2" />
                  <span>{formatDate(event.startDate)}</span>
                </div>
                <div className="flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  <span>{formatTime(event.startDate)} - {formatTime(event.endDate)}</span>
                </div>
                <div className="flex items-center">
                  <MapPin className="w-5 h-5 mr-2" />
                  <span>{event.isVirtual ? "Virtual Event" : event.location}</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleShare}>
                  <Share className="w-4 h-4 mr-2" />
                  Share
                </Button>
                {/* <Button
                  variant={isEventSaved ? "default" : "outline"}
                  size="sm"
                  onClick={handleSave}
                  disabled={saveEventMutation.isPending}
                >
                  <Heart
                    className={`w-4 h-4 mr-2 ${isEventSaved ? "fill-current" : ""}`}
                  />
                  {isEventSaved ? "Saved" : "Save"}
                </Button> */}
              </div>
            </div>

            {/* Event Description */}
            <Card>
              <CardHeader>
                <CardTitle>About This Event</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-gray max-w-none">
                  <p className="whitespace-pre-wrap">{event.description}</p>
                </div>
              </CardContent>
            </Card>

            {/* Event Details */}
            <Card>
              <CardHeader>
                <CardTitle>Event Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Date & Time</h4>
                    <p className="text-gray-600">
                      {formatDate(event.startDate)} at {formatTime(event.startDate)}
                    </p>
                    <p className="text-gray-600">
                      Ends {formatDate(event.endDate)} at {formatTime(event.endDate)}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Location</h4>
                    {event.isVirtual ? (
                      <div>
                        <p className="text-gray-600">Virtual Event</p>
                        {event.virtualLink && (
                          <a
                            href={event.virtualLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline flex items-center"
                          >
                            Join Virtual Event <ExternalLink className="w-4 h-4 ml-1" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <div>
                        {event.venue && <p className="font-medium text-gray-900">{event.venue}</p>}
                        <p className="text-gray-600">{event.location}</p>
                      </div>
                    )}
                  </div>
                </div>
                {event.maxAttendees && (
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-1">Capacity</h4>
                    <p className="text-gray-600 flex items-center">
                      <Users className="w-4 h-4 mr-2" />
                      Maximum {event.maxAttendees} attendees
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Booking Sidebar */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Get Tickets</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tickets.length === 0 ? (
                  <p className="text-gray-600">No tickets available for this event.</p>
                ) : (
                  <>
                    {/* Free Tickets */}
                    {freeTickets.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-gray-900">Free Tickets</h4>
                        {freeTickets.map((ticket: TicketType) => (
                          <div
                            key={ticket.id}
                            className={`border rounded-lg p-3 cursor-pointer transition-colors ${selectedTicket === ticket.id
                              ? "border-primary bg-primary/5"
                              : "border-gray-200 hover:border-gray-300"
                              }`}
                            onClick={() => setSelectedTicket(ticket.id)}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-medium text-gray-900">{ticket.name}</h5>
                                {ticket.description && (
                                  <p className="text-sm text-gray-600">{ticket.description}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-600">Free</div>
                                <div className="text-xs text-gray-500">
                                  {ticket.quantity - ticket.sold} available
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Paid Tickets */}
                    {paidTickets.length > 0 && (
                      <div className="space-y-2">
                        <h4 className="font-semibold text-gray-900">Paid Tickets</h4>
                        {paidTickets.map((ticket: TicketType) => (
                          <div
                            key={ticket.id}
                            className={`border rounded-lg p-3 cursor-pointer transition-colors ${selectedTicket === ticket.id
                              ? "border-primary bg-primary/5"
                              : "border-gray-200 hover:border-gray-300"
                              }`}
                            onClick={() => setSelectedTicket(ticket.id)}
                          >
                            <div className="flex justify-between items-start">
                              <div>
                                <h5 className="font-medium text-gray-900">{ticket.name}</h5>
                                {ticket.description && (
                                  <p className="text-sm text-gray-600">{ticket.description}</p>
                                )}
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-primary">${ticket.price}</div>
                                <div className="text-xs text-gray-500">
                                  {ticket.quantity - ticket.sold} available
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quantity Selector */}
                    {selectedTicket && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Quantity
                        </label>
                        <select
                          value={quantity}
                          onChange={(e) => setQuantity(parseInt(e.target.value))}
                          className="w-full border border-gray-300 rounded-md px-3 py-2"
                        >
                          {[...Array(Math.min(10, tickets.find((t: TicketType) => t.id === selectedTicket)?.quantity - tickets.find((t: TicketType) => t.id === selectedTicket)?.sold || 1))].map((_, i) => (
                            <option key={i + 1} value={i + 1}>
                              {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Total */}
                    {selectedTicket && (
                      <div className="border-t pt-4">
                        <div className="flex justify-between items-center text-lg font-bold">
                          <span>Total</span>
                          <span className="text-primary">
                            ${(parseFloat(tickets.find((t: TicketType) => t.id === selectedTicket)?.price || "0") * quantity).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Book Button */}
                    <Button
                      onClick={handleBooking}
                      disabled={!selectedTicket || bookingMutation.isPending}
                      className="w-full"
                    >
                      {bookingMutation.isPending ? "Processing..." : "Book Tickets"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Organizer Info */}
            <Card>
              <CardHeader>
                <CardTitle>Organizer</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-3">
                  <Avatar>
                    <AvatarImage src="" />
                    <AvatarFallback>OR</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-gray-900">Event Organizer</p>
                    <p className="text-sm text-gray-600">Organizing since 2020</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}