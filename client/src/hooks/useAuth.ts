import { useQuery } from "@tanstack/react-query";

export function useAuth() {
  const token = localStorage.getItem('auth_token');
  
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/user"],
    retry: false,
    enabled: !!token, // Only run query if token exists
  });

  return {
    user,
    isLoading: isLoading && !!token, // Only show loading if we have a token
    isAuthenticated: !!user && !!token,
  };
}
