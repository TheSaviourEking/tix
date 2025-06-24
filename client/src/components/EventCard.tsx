import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { Link } from "wouter";
import type { Event } from "@shared/schema";

interface EventCardProps {
  event: Event & {
    ticketTypes?: Array<{ price: string; name: string }>;
    attendeeCount?: number;
  };
}

export default function EventCard({ event }: EventCardProps) {
  console.log(event, 'EVENT IN CARD')
  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  };

  const formatTime = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      // minute: "2-digit",
      hour12: true,
    });
  };

  const getMinPrice = () => {
    // if (!event.ticketTypes || event.ticketTypes.length === 0) return "Free";
     if (!event.ticketTypes || event.ticketTypes.length === 0) return "TBD";
    const prices = event.ticketTypes.map(t => parseFloat(t.price));
    const minPrice = Math.min(...prices);
    return minPrice === 0 ? "Free" : `$${minPrice}`;
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      music: "bg-pink-100 text-pink-700",
      tech: "bg-blue-100 text-blue-700",
      business: "bg-purple-100 text-purple-700",
      fitness: "bg-green-100 text-green-700",
      food: "bg-yellow-100 text-yellow-700",
      education: "bg-indigo-100 text-indigo-700",
      arts: "bg-pink-100 text-pink-700",
      nature: "bg-green-100 text-green-700",
    };
    return colors[category?.toLowerCase()] || "bg-gray-100 text-gray-700";
  };

  return (
    <Card className="overflow-hidden hover:shadow-xl transition-all duration-200 transform hover:scale-105 group cursor-pointer">
      <div className="relative">
        <img
          src={event.imageUrl || "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&h=240&fit=crop"}
          alt={event.title}
          className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <div className="absolute top-4 left-4">
          <Badge className={getCategoryColor(event.category)}>
            {event.category}
          </Badge>
        </div>
      </div>

      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <CalendarDays className="w-4 h-4 mr-1" />
            {formatDate(event.startDate)}
          </div>
          <span className="text-sm text-muted-foreground">
            {formatTime(event.startDate)}
          </span>
        </div>

        <h3 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors duration-200">
          {event.title}
        </h3>

        <div className="flex items-center text-muted-foreground mb-3">
          <MapPin className="w-4 h-4 mr-2 flex-shrink-0" />
          <span className="truncate">{event.location}</span>
        </div>

        <p className="text-muted-foreground text-sm mb-4 line-clamp-2">
          {event.shortDescription || event.description}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <span className="text-2xl font-bold text-primary">{getMinPrice()}</span>
            {getMinPrice() !== "Free" && (
              <span className="text-muted-foreground ml-1">/ person</span>
            )}
          </div>
          <Link href={`/events/${event.id}`}>
            <Button className="bg-primary hover:bg-primary/90">
              View Details
            </Button>
          </Link>
        </div>

        {event.attendeeCount !== undefined && (
          <div className="flex items-center mt-3 pt-3 border-t">
            <Users className="w-4 h-4 mr-2 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {event.attendeeCount} attending
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
