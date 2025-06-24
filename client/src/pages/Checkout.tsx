import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarDays, MapPin, Users, Lock, CreditCard } from "lucide-react";
import { Link } from "wouter";

// Make sure to call `loadStripe` outside of a component's render to avoid
// recreating the `Stripe` object on every render.
console.log('Stripe Key:', import.meta.env.VITE_STRIPE_PUBLIC_KEY);
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  throw new Error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY);

const CheckoutForm = ({ booking }: { booking: any }) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const confirmPaymentMutation = useMutation({
    mutationFn: async (paymentIntentId: string) => {
      const response = await apiRequest("POST", "/api/payment-success", { paymentIntentId });
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Payment Successful!",
        description: "Your booking has been confirmed. Check your email for details.",
      });
      // Redirect to booking confirmation or success page
      setTimeout(() => {
        window.location.href = `/bookings`;
      }, 2000);
    },
    onError: (error) => {
      toast({
        title: "Payment Processing Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/success`,
      },
      redirect: "if_required",
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsLoading(false);
    } else if (paymentIntent && paymentIntent.status === "succeeded") {
      confirmPaymentMutation.mutate(paymentIntent.id);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="bg-gray-50 p-4 rounded-lg">
        <div className="flex items-center mb-2">
          <Lock className="w-4 h-4 text-gray-500 mr-2" />
          <span className="text-sm text-gray-600">Your payment information is secure and encrypted</span>
        </div>
      </div>

      <PaymentElement />

      <Button
        type="submit"
        disabled={!stripe || isLoading || confirmPaymentMutation.isPending}
        className="w-full"
        size="lg"
      >
        {isLoading || confirmPaymentMutation.isPending ? (
          <>
            <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
            Processing Payment...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Complete Payment
          </>
        )}
      </Button>
    </form>
  );
};

export default function Checkout() {
  const { bookingId } = useParams();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const [clientSecret, setClientSecret] = useState("");

  // Fetch booking details
  const { data: booking, isLoading: bookingLoading, error } = useQuery({
    queryKey: [`/api/bookings/${bookingId}`],
    enabled: !!bookingId && isAuthenticated,
  });

  // Create payment intent
  useEffect(() => {
    console.log(booking, 'BOOKING DETAILS')
    if (booking && isAuthenticated) {
      apiRequest("POST", "/api/create-payment-intent", { bookingId: booking.id })
        .then((res) => res.json())
        .then((data) => {
          setClientSecret(data.clientSecret);
        })
        .catch((error) => {
          toast({
            title: "Payment Setup Failed",
            description: error.message,
            variant: "destructive",
          });
        });
    }
  }, [booking, isAuthenticated, toast]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Authentication required",
        description: "Please log in to complete your booking.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 1000);
    }
  }, [isAuthenticated, authLoading, toast]);

  if (authLoading || bookingLoading) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-12 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold mb-4">Authentication Required</h2>
            <p className="text-gray-600">Redirecting to login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !booking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <h2 className="text-xl font-bold mb-4 text-red-600">Booking Not Found</h2>
            <p className="text-gray-600 mb-4">
              The booking you're trying to pay for doesn't exist or you don't have permission to access it.
            </p>
            <Link href="/events">
              <Button>Browse Events</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-600">Setting up payment...</p>
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

  // Make SURE to wrap the form in <Elements> which provides the stripe context.
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Booking</h1>
          <p className="text-gray-600">Review your order and complete payment</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Booking Summary */}
          <Card>
            <CardHeader>
              <CardTitle>Booking Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Event Details */}
              <div>
                <h3 className="font-semibold text-gray-900 mb-3">{booking.event?.title}</h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-600">
                    <CalendarDays className="w-4 h-4 mr-2" />
                    <span>
                      {formatDate(booking.event?.startDate)} at {formatTime(booking.event?.startDate)}
                    </span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <MapPin className="w-4 h-4 mr-2" />
                    <span>{booking.event?.isVirtual ? "Virtual Event" : booking.event?.location}</span>
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Users className="w-4 h-4 mr-2" />
                    <span>{booking.quantity} ticket(s)</span>
                  </div>
                </div>
              </div>

              {/* Ticket Details */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-2">Ticket Information</h4>
                <div className="bg-gray-50 rounded-lg p-3">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="font-medium">{booking.ticketType?.name}</span>
                      <Badge className="ml-2 text-xs">x{booking.quantity}</Badge>
                    </div>
                    <span className="font-medium">${booking.ticketType?.price}</span>
                  </div>
                  {booking.ticketType?.description && (
                    <p className="text-sm text-gray-600 mt-1">{booking.ticketType.description}</p>
                  )}
                </div>
              </div>

              {/* Attendee Details */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-900 mb-2">Attendee Information</h4>
                <div className="text-sm text-gray-600">
                  <p><strong>Name:</strong> {booking.attendeeName}</p>
                  <p><strong>Email:</strong> {booking.attendeeEmail}</p>
                  <p><strong>Booking Reference:</strong> {booking.bookingReference}</p>
                </div>
              </div>

              {/* Total */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg font-bold">
                  <span>Total Amount</span>
                  <span className="text-primary">${parseFloat(booking.totalAmount).toFixed(2)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2" />
                Payment Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm booking={booking} />
              </Elements>
            </CardContent>
          </Card>
        </div>

        {/* Security Notice */}
        <div className="mt-8 text-center text-sm text-gray-500">
          <p>
            🔒 Your payment is secured by Stripe. We never store your payment information.
          </p>
        </div>
      </div>
    </div>
  );
}
