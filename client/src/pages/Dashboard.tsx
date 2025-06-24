import { useEffect } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CalendarDays,
  DollarSign,
  Users,
  Star,
  Plus,
  Eye,
  Edit,
  MoreHorizontal,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { Event } from "@shared/schema";

export default function Dashboard() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Authentication required",
        description: "Please log in to access your dashboard.",
        variant: "destructive",
      });
      setTimeout(() => {
        window.location.href = "/login";
      }, 1000);
    }
  }, [isAuthenticated, authLoading, toast]);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["/api/dashboard/stats"],
    queryFn: () => apiRequest("GET", "/api/dashboard/stats"),
    enabled: isAuthenticated,
  });

  const { data, isLoading: eventsLoading, error: eventsError } = useQuery({
    queryKey: ["/api/dashboard/events"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/dashboard/events");
      const result = await response.json();
      // Normalize data to array
      return Array.isArray(result) ? result : result.events || [];
    },
    enabled: isAuthenticated,
  });

  // Normalize events to array and log for debugging
  const events = Array.isArray(data) ? data : data?.events || [];
  console.log("Events data:", events, typeof events, data);

  const publishMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return await apiRequest("PATCH", `/api/events/${eventId}/publish`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/events"] });
      toast({
        title: "Event Published",
        description: "Your event is now live and visible to attendees.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to publish event",
        variant: "destructive",
      });
    },
  });

  const unpublishMutation = useMutation({
    mutationFn: async (eventId: string) => {
      return await apiRequest("PATCH", `/api/events/${eventId}/unpublish`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/events"] });
      toast({
        title: "Event Unpublished",
        description: "Your event is now in draft mode.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to publish event",
        variant: "destructive",
      });
    },
  });

  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (eventsError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-red-600">Error loading events: {eventsError.message}</p>
            <Button
              onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/dashboard/events"] })}
              className="mt-4"
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      draft: { label: "Draft", className: "bg-gray-100 text-gray-700" },
      published: { label: "Published", className: "bg-green-100 text-green-700" },
      cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700" },
      completed: { label: "Completed", className: "bg-blue-100 text-blue-700" },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft;
    return <Badge className={config.className}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 pb-6 border-b border-gray-200">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Event Dashboard</h1>
            <p className="text-gray-600">
              Welcome back, <span className="font-semibold">{user?.firstName || "Organizer"}</span>
            </p>
          </div>
          <Link href="/create">
            <Button className="mt-4 lg:mt-0 bg-primary hover:bg-primary/90">
              <Plus className="w-4 h-4 mr-2" />
              Create New Event
          </Button>
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-primary font-medium text-sm">Total Events</p>
                <p className="text-2xl font-bold text-primary">
                  {statsLoading ? "..." : stats?.totalEvents || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <CalendarDays className="text-primary" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-green-600 font-medium text-sm">Total Revenue</p>
                <p className="text-2xl font-bold text-green-700">
                  {statsLoading ? "..." : `$${stats?.totalRevenue || "0"}`}
                </p>
              </div>
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <DollarSign className="text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-blue-600 font-medium text-sm">Total Attendees</p>
                <p className="text-2xl font-bold text-blue-700">
                  {statsLoading ? "..." : stats?.totalAttendees || 0}
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <div>
                <p className="text-yellow-600 font-medium text-sm">Avg Rating</p>
                <p className="text-2xl font-bold text-yellow-700">
                  {statsLoading ? "..." : stats?.avgRating || "N/A"}
                </p>
              </div>
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <Star className="text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Events Table */}
        <Card>
          <CardHeader>
            <CardTitle>Your Events</CardTitle>
          </CardHeader>
          <CardContent>
            {eventsLoading ? (
              <div className="space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-100 rounded animate-pulse"></div>
                ))}
              </div>
            ) : events.length === 0 ? (
              <div className="text-center py-12">
                <CalendarDays className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No events yet</h3>
                <p className="text-gray-600 mb-4">Create your first event to get started</p>
                <Link href="/create">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" />
                    Create Event
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Event Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Attendees</TableHead>
                      <TableHead>Revenue</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((event: Event & { attendeeCount?: number; revenue?: string }) => (
                      <TableRow key={event.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium text-gray-900">{event.title}</p>
                            <p className="text-sm text-gray-600">{event.location}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <p className="text-gray-900">{formatDate(event.startDate)}</p>
                            <p className="text-gray-600">
                              {new Date(event.startDate).toLocaleTimeString("en-US", {
                                hour: "numeric",
                                minute: "2-digit",
                                hour12: true,
                              })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>{getStatusBadge(event.status)}</TableCell>
                        <TableCell>
                          <span className="text-gray-900">{event.attendeeCount || 0}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-gray-900">${event.revenue || "0.00"}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center space-x-2">
                            <Link href={`/events/${event.id}`}>
                              <Button variant="ghost" size="sm">
                                <Eye className="w-4 h-4" />
                              </Button>
                            </Link>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent>
                                <Link href={`/events/${event.id}/edit`}>
                                  <DropdownMenuItem>
                                    <Edit className="w-4 h-4 mr-2" />
                                    Edit Event
                                  </DropdownMenuItem>
                                </Link>
                                {event.status === "draft" ? (
                                  <DropdownMenuItem
                                    onClick={() => publishMutation.mutate(event.id)}
                                    disabled={publishMutation.isPending}
                                  >
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Publish Event
                                  </DropdownMenuItem>
                                ) : (
                                  <DropdownMenuItem
                                    onClick={() => unpublishMutation.mutate(event.id)}
                                    disabled={unpublishMutation.isPending}
                                  >
                                    <XCircle className="w-4 h-4 mr-2" />
                                    Unpublish Event
                                  </DropdownMenuItem>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}