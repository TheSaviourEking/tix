import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import EventCard from "@/components/EventCard";
import SearchFilters, { SearchFilters as FilterType } from "@/components/SearchFilters";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Event } from "@shared/schema";

export default function Events() {
  const [location] = useLocation();
  const [filters, setFilters] = useState<FilterType>({
    search: "",
    location: "",
    category: "",
    startDate: "",
    endDate: "",
  });
  const [page, setPage] = useState(1);
  const limit = 12;

  // Parse URL parameters on mount
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setFilters({
      search: urlParams.get("search") || "",
      location: urlParams.get("location") || "",
      category: urlParams.get("category") || "",
      startDate: urlParams.get("startDate") || "",
      endDate: urlParams.get("endDate") || "",
    });
  }, [location]);

  const buildQueryKey = () => {
    const params: Record<string, any> = { page, limit };
    if (filters.search) params.search = filters.search;
    if (filters.location) params.location = filters.location;
    if (filters.category) params.category = filters.category;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    return ["/api/events", params];
  };

  // const { data: eventsData, isLoading, error } = useQuery({
  //   queryKey: buildQueryKey(),
  // });

  const { data: eventsData, isLoading, error } = useQuery({
    queryKey: buildQueryKey(),
    queryFn: async ({ queryKey }) => {
      const [, params] = queryKey;
      const urlParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value) urlParams.set(key, value);
      });
      console.log("Sending request to /api/events with params:", urlParams.toString()); // Debug log
      const response = await fetch(`/api/events?${urlParams.toString()}`);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return response.json();
    },
    refetchOnWindowFocus: false, // Prevent stale cache issues
  });

  const events = eventsData?.events || [];
  const totalEvents = eventsData?.total || 0;
  const totalPages = Math.ceil(totalEvents / limit);

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    console.log(`Filter changed: ${key}=${value}`);
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onSearch(newFilters);
  };

  // const handleSearch = (newFilters: FilterType) => {
  //   setFilters(newFilters);
  //   setPage(1);

  //   // Update URL
  //   const params = new URLSearchParams();
  //   Object.entries(newFilters).forEach(([key, value]) => {
  //     if (value) params.set(key, value);
  //   });
  //   const newUrl = `/events${params.toString() ? `?${params.toString()}` : ""}`;
  //   window.history.replaceState({}, "", newUrl);
  // };

  const handleSearch = (newFilters: FilterType) => {
    const validatedFilters = {
      ...newFilters,
      startDate: newFilters.startDate ? new Date(newFilters.startDate).toISOString() : "",
      endDate: newFilters.endDate ? new Date(newFilters.endDate + "T23:59:59.999Z").toISOString() : "",
    };
    setFilters(validatedFilters);
    setPage(1);

    const params = new URLSearchParams();
    Object.entries(validatedFilters).forEach(([key, value]) => {
      if (value && value !== "all") params.set(key, value);
    });
    const newUrl = `/events${params.toString() ? `?${params.toString()}` : ""}`;
    console.log("Updating URL to:", newUrl);
    window.history.replaceState({}, "", newUrl);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Events</h2>
          <p className="text-gray-600 mb-4">Something went wrong while fetching events.</p>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-4">Discover Events</h1>
          <p className="text-lg text-gray-600">
            Find amazing events happening around you
          </p>
        </div>

        {/* Search Filters */}
        <div className="mb-8">
          <SearchFilters onSearch={handleSearch} loading={isLoading} />
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-gray-600">
            {isLoading ? (
              "Searching..."
            ) : (
              `Showing ${events.length} of ${totalEvents} events`
            )}
          </p>
        </div>

        {/* Events Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
            {[...Array(limit)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-lg overflow-hidden">
                <Skeleton className="w-full h-48" />
                <div className="p-6 space-y-3">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-6 w-full" />
                  <Skeleton className="h-4 w-1/2" />
                  <div className="flex justify-between items-center pt-2">
                    <Skeleton className="h-6 w-20" />
                    <Skeleton className="h-10 w-24" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-100 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No events found</h3>
            <p className="text-gray-600 mb-4">
              Try adjusting your search criteria or browse all events
            </p>
            <Button onClick={() => handleSearch({
              search: "",
              location: "",
              category: "",
              startDate: "",
              endDate: "",
            })}>
              Clear Filters
            </Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-8">
              {events.map((event: Event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center space-x-2">
                <Button
                  variant="outline"
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                >
                  Previous
                </Button>

                {[...Array(Math.min(5, totalPages))].map((_, i) => {
                  const pageNum = i + 1;
                  const isCurrentPage = pageNum === page;

                  return (
                    <Button
                      key={pageNum}
                      variant={isCurrentPage ? "default" : "outline"}
                      onClick={() => handlePageChange(pageNum)}
                      className={isCurrentPage ? "bg-primary text-white" : ""}
                    >
                      {pageNum}
                    </Button>
                  );
                })}

                {totalPages > 5 && page < totalPages - 2 && (
                  <>
                    <span className="px-2">...</span>
                    <Button
                      variant="outline"
                      onClick={() => handlePageChange(totalPages)}
                    >
                      {totalPages}
                    </Button>
                  </>
                )}

                <Button
                  variant="outline"
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
