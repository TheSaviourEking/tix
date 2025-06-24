import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import EventForm from "@/components/EventForm";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useEffect } from "react";
import { useParams } from "wouter";

export default function EventPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const { toast } = useToast();
  const { id: eventId } = useParams(); // Get eventId from URL
  const isEditMode = !!eventId; // Edit mode if eventId exists

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast({
        title: "Authentication required",
        description: `Please log in to ${isEditMode ? "edit" : "create"} an event.`,
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 1000);
    }
  }, [isAuthenticated, isLoading, toast, isEditMode]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
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

  const handleEventSuccess = (eventId: string) => {
    toast({
      title: isEditMode ? "Event updated successfully!" : "Event created successfully!",
      description: isEditMode
        ? "Your event has been updated."
        : "Your event is now live and ready for attendees.",
    });
    // Redirect to event details or dashboard
    // setTimeout(() => {
    //   window.location.href = `/events/${eventId}`;
    // }, 1000);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">
            {isEditMode ? "Edit Event" : "Create New Event"}
          </h1>
          <p className="text-lg text-gray-600">
            {isEditMode
              ? "Update the details below to modify your event."
              : "Fill out the form below to create your event and start selling tickets."}
          </p>
        </div>

        {/* Form */}
        <EventForm
          onSuccess={handleEventSuccess}
          isEditMode={isEditMode}
          eventId={eventId || null}
        />
      </div>
    </div>
  );
}