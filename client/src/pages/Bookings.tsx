import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Clock, Ticket, Download } from "lucide-react";
import { format, isValid } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import { apiRequest } from "@/lib/queryClient";

interface Booking {
  id: string;
  event_id: string;
  event: {
    title: string;
    start_date: string;
    location: string;
    image_url?: string;
  };
  ticket_type: {
    name: string;
    price: string;
  };
  quantity: number;
  total_amount: string;
  booking_reference: string;
  status: "confirmed" | "pending" | "cancelled";
  attendee_email?: string;
  attendee_name?: string;
}

const downloadTicket = async (bookingId: string, bookingReference: string, toast: ReturnType<typeof useToast>["toast"]) => {
  try {
    const response = await apiRequest("GET", `/api/bookings/${bookingId}/ticket`);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ticket-${bookingReference}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    toast({
      title: "Ticket downloaded",
      description: "Your ticket has been downloaded successfully.",
    });
  } catch (error) {
    console.error('Error downloading ticket:', error);
    toast({
      title: "Download failed",
      description: "Failed to download ticket. Please try again.",
      variant: "destructive",
    });
  }
};

export default function Bookings() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Redirect to login if not authenticated
  if (!isLoading && !isAuthenticated) {
    setLocation('/login');
    return null;
  }

  const { data: bookings = [], isLoading: bookingsLoading, error } = useQuery({
    queryKey: ["/api/bookings"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/bookings");
      return response.json();
    },
    enabled: isAuthenticated && !isLoading,
    retry: (failureCount, error) => {
      if (error.message.includes('Unauthorized')) {
        setLocation('/login');
        return false;
      }
      return failureCount < 3;
    },
  });

  if (isLoading || bookingsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 rounded w-1/4 mb-8"></div>
            <div className="space-y-6">
              <div className="h-64 bg-gray-300 rounded-xl"></div>
              <div className="h-64 bg-gray-300 rounded-xl"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="text-center py-12">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Failed to Load Bookings</h2>
            <p className="text-gray-600 mb-4">Unable to load your bookings. Please try again.</p>
            <Button onClick={() => window.location.reload()}>
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Date not available';
    const date = new Date(dateString);
    if (!isValid(date)) return 'Invalid Date';
    return format(date, 'MMMM dd, yyyy');
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (!isValid(date)) return '';
    return format(date, 'h:mm a');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">My Bookings</h1>
          <p className="text-gray-600 mt-2">Manage your event tickets and reservations</p>
        </div>

        {bookings.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Ticket className="mx-auto h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings yet</h3>
              <p className="text-gray-600 mb-4">
                You haven't booked any events yet. Start exploring events to make your first booking.
              </p>
              <Link href="/events">
                <Button>Browse Events</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {bookings.map((booking: Booking) => (
              <Card key={booking.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="flex flex-col lg:flex-row">
                    {/* Event Image */}
                    <div className="lg:w-64 h-48 lg:h-auto">
                      <img
                        src={booking.event?.image_url || 'https://via.placeholder.com/400/300'}
                        alt={booking.event?.title || 'Event'}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    {/* Booking Details */}
                    <div className="flex-1 p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            {booking.event?.title || 'Event Title Not Available'}
                          </h3>
                          <div className="flex items-center text-gray-600 mb-2">
                            <Calendar className="w-4 h-4 mr-2" />
                            <span>
                              {formatDate(booking.event?.start_date)} at {formatTime(booking.event?.start_date)}
                            </span>
                          </div>
                          <div className="flex items-center text-gray-600 mb-2">
                            <MapPin className="w-4 h-4 mr-2" />
                            <span>{booking.event?.location || 'Location TBD'}</span>
                          </div>
                        </div>
                        <Badge className={getStatusColor(booking.status)}>
                          {booking.status}
                        </Badge>
                      </div>

                      {/* Ticket Information */}
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <p className="text-sm font-medium text-gray-500">Ticket Type</p>
                            <p className="text-sm text-gray-900">{booking.ticket_type?.name || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Quantity</p>
                            <p className="text-sm text-gray-900">{booking.quantity} tickets</p>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-500">Total Amount</p>
                            <p className="text-sm text-gray-900">${booking.total_amount}</p>
                          </div>
                        </div>
                      </div>

                      {/* Booking Reference and Actions */}
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-500">Booking Reference</p>
                          <p className="text-sm font-mono text-gray-900">{booking.booking_reference}</p>
                        </div>
                        <div className="flex space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => downloadTicket(booking.id, booking.booking_reference, toast)}
                            disabled={booking.status !== 'confirmed'}
                          >
                            <Download className="w-4 h-4 mr-2" />
                            Download Ticket
                          </Button>
                          {booking.status === 'confirmed' && (
                            <Link href={`/events/${booking.event_id}`}>
                              <Button size="sm">View Event</Button>
                            </Link>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}