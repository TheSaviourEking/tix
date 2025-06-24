import React, { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const Login = () => {
    const [, setLocation] = useLocation();
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    const [errors, setErrors] = useState<Record<string, string>>({});
    const { toast } = useToast();

    const loginMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await apiRequest('POST', '/api/auth/login', data);
            return await response.json();
        },
        onSuccess: (data) => {
            // Store JWT token
            if (data.token) {
                localStorage.setItem('auth_token', data.token);
            }
            toast({
                title: "Success",
                description: "Welcome back!",
            });
            // Reload to trigger auth state update
            window.location.href = '/';
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || 'Login failed',
                variant: "destructive",
            });
        }
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const validateForm = () => {
        const newErrors: any = {};

        if (!formData.email) {
            newErrors.email = 'Email is required';
        } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
            newErrors.email = 'Please enter a valid email address';
        }

        if (!formData.password) {
            newErrors.password = 'Password is required';
        } else if (formData.password.length < 6) {
            newErrors.password = 'Password must be at least 6 characters';
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!validateForm()) {
            return;
        }

        loginMutation.mutate({
            email: formData.email,
            password: formData.password
        });
    };

    const handleOAuthClick = (provider: string) => {
        window.location.href = `/api/auth/${provider}`;
    };

    const oauthProviders = [
        {
            id: 'google',
            name: 'Google',
            icon: (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="currentColor" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="currentColor" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="currentColor" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="currentColor" />
                </svg>
            ),
            primary: true
        }
    ];

    const stats = [
        { number: '10,000+', label: 'Events Created' },
        { number: '500K+', label: 'Happy Users' },
        { number: '4.8', label: 'Average Rating' }
    ];

    return (
        <div className="min-h-screen flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-md">
                {/* Main Auth Card */}
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    {/* Header with gradient border */}
                    <div className="h-1 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500"></div>

                    <div className="p-8 sm:p-10">
                        {/* Logo Section */}
                        <div className="text-center mb-8">
                            <div className="inline-flex items-center justify-center rounded-2xl mb-4">
                                <Link href="/" className="flex items-center">
                                    <img src={'/logo.png'} className="w-32" alt="Tix Logo" />
                                </Link>
                            </div>

                            <h1 className="text-3xl font-bold text-gray-900 mb-2">
                                Welcome Back
                            </h1>
                            <p className="text-gray-600">
                                Sign in to continue creating amazing events
                            </p>
                        </div>

                        {/* Stats Section */}
                        <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
                            <div className="grid grid-cols-3 gap-4">
                                {stats.map((stat, index) => (
                                    <div key={index} className="text-center">
                                        <div className="text-xl font-bold text-indigo-600 mb-1">
                                            {stat.number}
                                        </div>
                                        <div className="text-xs text-gray-500 uppercase tracking-wide">
                                            {stat.label}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* OAuth Buttons */}
                        <div className="space-y-3 mb-6">
                            {oauthProviders.map((provider) => (
                                <button
                                    key={provider.id}
                                    onClick={() => handleOAuthClick(provider.id)}
                                    disabled={loginMutation.isPending}
                                    className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 font-semibold text-base transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] ${provider.primary
                                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent hover:from-indigo-600 hover:to-purple-700 shadow-lg hover:shadow-xl'
                                        : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-gray-50 hover:shadow-md'
                                        } ${loginMutation.isPending ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg'}`}
                                >
                                    {provider.icon}
                                    Continue with {provider.name}
                                </button>
                            ))}
                        </div>

                        <div className="relative mb-6">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-200"></div>
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-4 bg-white text-gray-500">Or continue with email</span>
                            </div>
                        </div>

                        {/* Email/Password Form */}
                        <form onSubmit={handleSubmit} className="space-y-4 mb-6">
                            {/* Email Input */}
                            <div>
                                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                                    Email Address
                                </label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleInputChange}
                                    className={`w-full px-4 py-3 border-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-indigo-300'
                                        }`}
                                    placeholder="Enter your email"
                                />
                                {errors.email && (
                                    <p className="mt-1 text-sm text-red-600">{errors.email}</p>
                                )}
                            </div>

                            {/* Password Input */}
                            <div>
                                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                                    Password
                                </label>
                                <input
                                    type="password"
                                    id="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleInputChange}
                                    className={`w-full px-4 py-3 border-2 rounded-2xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${errors.password ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-indigo-300'
                                        }`}
                                    placeholder="Enter your password"
                                />
                                {errors.password && (
                                    <p className="mt-1 text-sm text-red-600">{errors.password}</p>
                                )}
                            </div>

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loginMutation.isPending}
                                className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-semibold py-4 px-6 rounded-2xl hover:from-indigo-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                            >
                                {loginMutation.isPending ? (
                                    <div className="flex items-center justify-center">
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                                        Signing In...
                                    </div>
                                ) : (
                                    'Sign In'
                                )}
                            </button>
                        </form>

                        {/* Link to Register */}
                        <div className="text-center">
                            <p className="text-gray-600">
                                Don't have an account?
                                <Link href="/register" className="ml-2 font-semibold text-indigo-600 hover:text-indigo-500 focus:outline-none focus:underline">
                                    Sign up
                                </Link>
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;