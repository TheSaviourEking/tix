import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Search, MapPin, Calendar, X } from "lucide-react";

interface SearchFiltersProps {
  onSearch: (filters: SearchFilters) => void;
  loading?: boolean;
}

export interface SearchFilters {
  search: string;
  location: string;
  category: string;
  startDate: string;
  endDate: string;
}

export default function SearchFilters({ onSearch, loading }: SearchFiltersProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    search: "",
    location: "",
    category: "all",
    startDate: "",
    endDate: "",
  });

  const categories = [
    { value: "all", label: "All Categories" },
    { value: "music", label: "Music" },
    { value: "tech", label: "Technology" },
    { value: "business", label: "Business" },
    { value: "fitness", label: "Fitness" },
    { value: "food", label: "Food & Drink" },
    { value: "education", label: "Education" },
    { value: "arts", label: "Arts & Culture" },
    { value: "nature", label: "Nature & Outdoors" },
  ];

  const handleFilterChange = (key: keyof SearchFilters, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onSearch(newFilters); // Call onSearch immediately
  };

  const clearFilters = () => {
    const clearedFilters = {
      search: "",
      location: "",
      category: "all",
      startDate: "",
      endDate: "",
    };
    setFilters(clearedFilters);
    onSearch(clearedFilters);
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === "category" && value === "all") return false;
    return value !== "";
  });

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search events..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex-1 relative">
            <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Location..."
              value={filters.location}
              onChange={(e) => handleFilterChange("location", e.target.value)}
              className="pl-10"
            />
          </div>

          <Button
            onClick={() => onSearch(filters)} // Keep the button for manual triggering
            disabled={loading}
            className="bg-primary hover:bg-primary/90 px-8"
          >
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <Select
            value={filters.category}
            onValueChange={(value) => handleFilterChange("category", value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              {categories.map((category) => (
                <SelectItem key={category.value} value={category.value}>
                  {category.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="date"
              placeholder="Start Date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange("startDate", e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              type="date"
              placeholder="End Date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange("endDate", e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-muted-foreground">Active filters:</span>
            {filters.search && (
              <Badge variant="secondary" className="gap-1">
                Search: {filters.search}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => handleFilterChange("search", "")}
                />
              </Badge>
            )}
            {filters.location && (
              <Badge variant="secondary" className="gap-1">
                Location: {filters.location}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => handleFilterChange("location", "")}
                />
              </Badge>
            )}
            {filters.category && filters.category !== "all" && (
              <Badge variant="secondary" className="gap-1">
                Category: {categories.find((c) => c.value === filters.category)?.label}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => handleFilterChange("category", "all")}
                />
              </Badge>
            )}
            {filters.startDate && (
              <Badge variant="secondary" className="gap-1">
                From: {new Date(filters.startDate).toLocaleDateString()}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => handleFilterChange("startDate", "")}
                />
              </Badge>
            )}
            {filters.endDate && (
              <Badge variant="secondary" className="gap-1">
                To: {new Date(filters.endDate).toLocaleDateString()}
                <X
                  className="w-3 h-3 cursor-pointer"
                  onClick={() => handleFilterChange("endDate", "")}
                />
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear all
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}