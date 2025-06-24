import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";

// Layout Components
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// Pages
import Home from "@/pages/Home";
import Events from "@/pages/Events";
import EventDetails from "@/pages/EventDetails";
import EventPage from "@/pages/EventPage";
import Dashboard from "@/pages/Dashboard";
import Checkout from "@/pages/Checkout";
import Bookings from "@/pages/Bookings";
import AdminDashboard from "@/pages/AdminDashboard";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";

// import Login from "./pages/Login";
import Signup from "./pages/Signup";

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}

function ProtectedRoute({ component: Component, ...props }: any) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login />;
  }

  return <Component {...props} />;
}

function Router() {
  return (
    <Switch>
      {/* Auth Routes */}
      <Route path="/login" component={Login} />
      <Route path="/register" component={Signup} />

      {/* Public Routes */}
      <Route path="/" component={Home} />
      <Route path="/events" component={Events} />
      <Route path="/events/:id" component={EventDetails} />

      {/* Protected Routes */}
      <Route path="/create" component={(props: any) => <ProtectedRoute component={EventPage} {...props} />} />
      <Route path="/events/:id/edit" component={(props: any) => <ProtectedRoute component={EventPage} {...props} />} />
      <Route path="/dashboard" component={(props: any) => <ProtectedRoute component={Dashboard} {...props} />} />
      <Route path="/bookings" component={(props: any) => <ProtectedRoute component={Bookings} {...props} />} />
      <Route path="/admin" component={(props: any) => <ProtectedRoute component={AdminDashboard} {...props} />} />
      <Route path="/checkout/:bookingId" component={(props: any) => <ProtectedRoute component={Checkout} {...props} />} />

      {/* Fallback to 404 */}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Layout>
          <Router />
        </Layout>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
