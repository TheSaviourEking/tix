import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import EventCard from "@/components/EventCard";
import { Search, MapPin, Plus, Users, Calendar, TrendingUp, Star } from "lucide-react";
import type { Event } from "@shared/schema";

export default function Home() {
  const [searchTerm, setSearchTerm] = useState("");
  const [location, setLocation] = useState("");

  // Fetch featured events
  const { data: events = [], isLoading } = useQuery({
    queryKey: ["/api/events", { limit: 6 }],
  });

  // Mock stats - in real app these would come from API
  const stats = {
    totalEvents: "1,000+",
    totalAttendees: "50K+",
    totalRevenue: "$2.5K+",
    avgRating: "4.8",
  };

  const categories = [
    { id: "music", name: "Music", icon: "🎵", color: "from-pink-500 to-rose-500" },
    { id: "tech", name: "Tech", icon: "💻", color: "from-blue-500 to-cyan-500" },
    { id: "fitness", name: "Fitness", icon: "💪", color: "from-green-500 to-emerald-500" },
    { id: "food", name: "Food", icon: "🍕", color: "from-yellow-500 to-orange-500" },
    { id: "business", name: "Business", icon: "💼", color: "from-purple-500 to-violet-500" },
    { id: "education", name: "Education", icon: "🎓", color: "from-indigo-500 to-blue-500" },
    { id: "arts", name: "Arts", icon: "🎨", color: "from-pink-500 to-red-500" },
    { id: "nature", name: "Nature", icon: "🌿", color: "from-green-500 to-teal-500" },
  ];

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.set("search", searchTerm);
    if (location) params.set("location", location);
    window.location.href = `/events?${params.toString()}`;
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-primary/5 via-white to-secondary/5 py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Hero Content */}
            <div className="space-y-8">
              <div className="space-y-4">
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Create & Discover
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
                    {" "}Amazing Events
                  </span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                  The most intuitive event management platform for creators and attendees.
                  Build unforgettable experiences with our comprehensive suite of tools.
                </p>
              </div>

              {/* Search Bar */}
              <Card className="p-6 shadow-lg border-gray-100">
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      placeholder="Search events..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-12 h-12 border-gray-200 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <div className="flex-1 relative">
                    <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <Input
                      placeholder="Location..."
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      className="pl-12 h-12 border-gray-200 focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                  <Button onClick={handleSearch} className="h-12 px-8 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70">
                    <Search className="w-4 h-4 mr-2" />
                    Search
                  </Button>
                </div>
              </Card>

              {/* CTA Buttons */}
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/create">
                  <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-lg">
                    <Plus className="w-5 h-5 mr-2" />
                    Create Your Event
                  </Button>
                </Link>
                <Link href="/events">
                  <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-primary text-primary hover:bg-primary hover:text-white">
                    <Search className="w-5 h-5 mr-2" />
                    Explore Events
                  </Button>
                </Link>
              </div>
            </div>

            {/* Hero Image */}
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1511578314322-379afb476865?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&h=600"
                alt="Professional conference networking event"
                className="rounded-2xl shadow-2xl w-full h-auto"
              />

              {/* Floating Stats Cards */}
              <div className="absolute -top-4 -left-4 bg-white rounded-xl p-4 shadow-lg">
                <div className="text-2xl font-bold text-primary">{stats.totalEvents}</div>
                <div className="text-sm text-gray-600">Events Created</div>
              </div>

              <div className="absolute -bottom-4 -right-4 bg-white rounded-xl p-4 shadow-lg">
                <div className="text-2xl font-bold text-secondary">{stats.totalAttendees}</div>
                <div className="text-sm text-gray-600">Happy Attendees</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Event Categories */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Explore Event Categories</h2>
            <p className="text-lg text-gray-600">Find events that match your interests and passions</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6">
            {categories.map((category) => (
              <Link key={category.id} href={`/events?category=${category.id}`}>
                <div className="text-center group cursor-pointer">
                  <div className={`w-16 h-16 mx-auto mb-3 bg-gradient-to-br ${category.color} rounded-2xl flex items-center justify-center group-hover:scale-110 transition-all duration-200 shadow-lg`}>
                    <span className="text-2xl">{category.icon}</span>
                  </div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-primary transition-colors duration-200">
                    {category.name}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Events */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row justify-between items-center mb-12">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Events</h2>
              <p className="text-lg text-gray-600">Don't miss these popular upcoming events</p>
            </div>
            <Link href="/events">
              <Button variant="ghost" className="text-primary hover:text-primary/80 font-semibold">
                View All Events →
              </Button>
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-white rounded-2xl shadow-lg overflow-hidden animate-pulse">
                  <div className="w-full h-48 bg-gray-200"></div>
                  <div className="p-6 space-y-3">
                    <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    <div className="h-6 bg-gray-200 rounded"></div>
                    <div className="h-4 bg-gray-200 rounded w-1/2"></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            // <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            //   {(events?.events || []).slice(0, 6).map((event: Event) => (
            //     { console.log(event, 'event') }
            //     // <EventCard key={event.id} event={event} />
            //   ))}
            // </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {(events?.events || []).slice(0, 6).map((event: Event) => {
                console.log(event, 'event');
                return <EventCard key={event.id} event={event} />;
              })}
            </div>
          )}
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">How Tix Works</h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From creation to celebration, we make event management simple and powerful
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Plus className="text-white text-2xl" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Create Your Event</h3>
              <p className="text-gray-600 leading-relaxed">
                Use our intuitive event builder to create professional events with rich descriptions,
                media uploads, and customizable ticketing options.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-secondary to-secondary/80 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <TrendingUp className="text-white text-2xl" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Promote & Sell</h3>
              <p className="text-gray-600 leading-relaxed">
                Leverage our marketing tools and discovery engine to reach your target audience.
                Process payments securely with our integrated system.
              </p>
            </div>

            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-green-500 to-green-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Star className="text-white text-2xl" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-4">Manage & Analyze</h3>
              <p className="text-gray-600 leading-relaxed">
                Track attendance, manage check-ins, and gain insights with our comprehensive
                analytics dashboard to improve future events.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-gradient-to-br from-gray-50 to-gray-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary mb-2">{stats.totalEvents}</div>
              <div className="text-gray-600">Events Created</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-secondary mb-2">{stats.totalAttendees}</div>
              <div className="text-gray-600">Happy Attendees</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">{stats.totalRevenue}</div>
              <div className="text-gray-600">Revenue Generated</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-yellow-600 mb-2">{stats.avgRating}</div>
              <div className="text-gray-600">Average Rating</div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
