import React, { useState, useCallback, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import logoImage from '@/assets/logo.png';
import { uploadImage } from '@/lib/imageUpload';

// --- Constants (Defined outside the component to prevent re-creation on render) ---

const OAUTH_PROVIDERS = [
    { id: 'google', name: 'Google', icon: <svg>...</svg>, primary: true }, // SVGs are truncated for brevity
    // { id: 'github', name: 'GitHub', icon: <svg>...</svg> },
    // { id: 'microsoft', name: 'Microsoft', icon: <svg>...</svg> }
];

const USER_TYPES = [
    { id: 'attendee', title: 'Event Attendee', description: 'Discover and attend amazing events', icon: '🎟️', features: ['Browse events', 'Book tickets', 'Join communities', 'Get recommendations'] },
    { id: 'organizer', title: 'Event Organizer', description: 'Create and manage your own events', icon: '🎯', features: ['Create events', 'Manage attendees', 'Analytics dashboard', 'Marketing tools'] },
    { id: 'business', title: 'Business/Enterprise', description: 'Advanced tools for businesses', icon: '🏢', features: ['Team management', 'Custom branding', 'Advanced analytics', 'Priority support'] }
];

const INTERESTS = [
    '🎵 Music & Concerts', '🎭 Arts & Theater', '💼 Business & Networking',
    '🏃 Sports & Fitness', '🍽️ Food & Dining', '🎓 Education & Learning',
    '👨‍👩‍👧‍👦 Family & Kids', '🌿 Health & Wellness', '💻 Technology',
    '🎨 Creative & Crafts', '🌍 Travel & Adventure', '🎮 Gaming & Entertainment'
];

const STATS = [
    { number: '50K+', label: 'Events Monthly' },
    { number: '1M+', label: 'Active Users' },
    { number: '4.9', label: 'App Rating' }
];

// --- Main Signup Component ---

const Signup = () => {
    const [currentStep, setCurrentStep] = useState(1);
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
        confirmPassword: '',
        profileImage: null,
        userType: '',
        interests: [],
        agreeToTerms: false,
        subscribeNewsletter: true
    });
    const [errors, setErrors] = useState({});
    const [imagePreview, setImagePreview] = useState(null);
    const { toast } = useToast();

    // Registration mutation using the same pattern as your Login component
    const registerMutation = useMutation({
        mutationFn: async (data: any) => {
            const response = await apiRequest('POST', '/api/auth/register', data);
            return await response.json();
        },
        onSuccess: (data) => {
            // Store JWT token
            if (data.token) {
                localStorage.setItem('auth_token', data.token);
            }
            toast({
                title: "Success",
                description: "Account created successfully! Welcome to Tix!",
            });
            // Redirect to dashboard or reload to trigger auth state update
            window.location.href = '/dashboard';
        },
        onError: (error: any) => {
            toast({
                title: "Error",
                description: error.message || 'Registration failed',
                variant: "destructive",
            });
            // Set form errors for display
            setErrors({ submit: error.message || 'Registration failed' });
        }
    });

    const validateStep = useCallback(() => {
        const newErrors = {};
        switch (currentStep) {
            case 1:
                if (!formData.firstName) newErrors.firstName = 'First name is required.';
                if (!formData.lastName) newErrors.lastName = 'Last name is required.';
                if (!formData.email) {
                    newErrors.email = 'Email is required.';
                } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
                    newErrors.email = 'Email address is invalid.';
                }
                if (!formData.password) {
                    newErrors.password = 'Password is required.';
                } else if (formData.password.length < 6) {
                    newErrors.password = 'Password must be at least 6 characters.';
                }
                if (formData.password !== formData.confirmPassword) {
                    newErrors.confirmPassword = 'Passwords do not match.';
                }
                break;
            case 2:
                if (!formData.userType) newErrors.userType = 'Please select a user type.';
                break;
            case 3:
                if (formData.interests.length === 0) newErrors.interests = 'Please select at least one interest.';
                if (!formData.agreeToTerms) newErrors.agreeToTerms = 'You must agree to the terms.';
                break;
            default:
                break;
        }
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    }, [formData, currentStep]);

    const handleOAuthClick = (provider: string) => {
        window.location.href = `/api/auth/${provider}`;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));

        // Clear error when user starts typing
        if (errors[name]) {
            setErrors(prev => ({
                ...prev,
                [name]: ''
            }));
        }
    };

    const handleImageChange = (e) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setFormData(prev => ({ ...prev, profileImage: file }));
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleInterestToggle = (interest) => {
        setFormData(prev => ({
            ...prev,
            interests: prev.interests.includes(interest)
                ? prev.interests.filter(i => i !== interest)
                : [...prev.interests, interest]
        }));
    };

    const nextStep = () => {
        if (validateStep()) {
            setCurrentStep(prev => Math.min(prev + 1, 3));
        }
    };

    const prevStep = () => {
        setCurrentStep(prev => Math.max(prev - 1, 1));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!validateStep()) {
            console.log('Final step validation failed.', errors);
            return;
        }

        // Clear previous submission errors
        setErrors({});

        try {
            let profileImageData = { url: '', publicId: '' };

            // Upload profile image if provided
            if (formData.profileImage) {
                profileImageData = await uploadImage(formData.profileImage, '/api/upload-profile-image');
            }

            console.log(profileImageData, 'Profile image data after upload');

            // Prepare the payload to match your API expectations
            const payload = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                email: formData.email,
                password: formData.password,
                confirmPassword: formData.confirmPassword,
                userType: formData.userType,
                interests: formData.interests,
                subscribeNewsletter: formData.subscribeNewsletter,
                profileImageUrl: profileImageData.url,
                profileImagePublicId: profileImageData.publicId, // Include public ID
            };

            console.log(payload, 'Payload to be sent to the server');

            registerMutation.mutate(payload);
        } catch (error: any) {
            toast({
                title: 'Error',
                description: error.message || 'Failed to upload profile image',
                variant: 'destructive',
            });
            setErrors({ submit: error.message || 'Failed to upload profile image' });
        }
    };

    const renderStepContent = () => {
        switch (currentStep) {
            case 1:
                return (
                    <Step1
                        formData={formData}
                        errors={errors}
                        loading={registerMutation.isPending}
                        imagePreview={imagePreview}
                        onInputChange={handleInputChange}
                        onImageChange={handleImageChange}
                        onOAuthClick={handleOAuthClick}
                    />
                );
            case 2:
                return (
                    <Step2
                        userType={formData.userType}
                        onUserTypeSelect={(type) => setFormData(prev => ({ ...prev, userType: type }))}
                        error={errors.userType}
                    />
                );
            case 3:
                return (
                    <Step3
                        formData={formData}
                        onInterestToggle={handleInterestToggle}
                        onInputChange={handleInputChange}
                        errors={errors}
                    />
                );
            default:
                return null;
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-2xl">
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
                    <div className="h-2 bg-gradient-to-r from-indigo-500 via-purple-600 to-pink-500">
                        <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${(currentStep / 3) * 100}%` }}></div>
                    </div>
                    <div className="p-8 sm:p-10">
                        <div className="text-center mb-6">
                            <div className="inline-flex items-center justify-center mb-4">
                                <img src={logoImage} className="w-32" alt="Tix Logo" />
                            </div>
                            <div className="flex justify-center gap-2 mb-6">
                                {[1, 2, 3].map((step) => (
                                    <div key={step} className={`w-3 h-3 rounded-full transition-all duration-300 ${step <= currentStep ? 'bg-indigo-500' : 'bg-gray-200'}`} />
                                ))}
                            </div>
                        </div>

                        {currentStep === 1 && (
                            <div className="bg-gray-50 rounded-2xl p-6 mb-8 border border-gray-100">
                                <div className="grid grid-cols-3 gap-4">
                                    {STATS.map((stat, index) => (
                                        <div key={index} className="text-center">
                                            <div className="text-xl font-bold text-indigo-600 mb-1">{stat.number}</div>
                                            <div className="text-xs text-gray-500 uppercase tracking-wide">{stat.label}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Show submission errors */}
                        {errors.submit && (
                            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl">
                                <p className="text-red-600 text-sm">{errors.submit}</p>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} noValidate>
                            {renderStepContent()}

                            <div className="flex gap-4 mt-8">
                                {currentStep > 1 && (
                                    <button
                                        type="button"
                                        onClick={prevStep}
                                        disabled={registerMutation.isPending}
                                        className="flex-1 px-6 py-4 border-2 border-gray-200 text-gray-700 font-semibold rounded-2xl hover:border-gray-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Previous
                                    </button>
                                )}
                                {currentStep < 3 ? (
                                    <button
                                        type="button"
                                        onClick={nextStep}
                                        disabled={registerMutation.isPending}
                                        className="flex-1 px-6 py-4 font-semibold rounded-2xl transition-all bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-lg hover:shadow-xl disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
                                    >
                                        Continue
                                    </button>
                                ) : (
                                    <button
                                        type="submit"
                                        disabled={registerMutation.isPending || !formData.agreeToTerms || formData.interests.length === 0}
                                        className="flex-1 px-6 py-4 font-semibold rounded-2xl transition-all flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white hover:from-indigo-600 hover:to-purple-700 shadow-lg hover:shadow-xl disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
                                    >
                                        {registerMutation.isPending ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                                Creating Account...
                                            </>
                                        ) : 'Create Account'}
                                    </button>
                                )}
                            </div>
                        </form>

                        <div className="text-center mt-6">
                            <span className="text-gray-600">Already have an account?</span>
                            <button className="ml-2 text-indigo-600 font-semibold hover:text-indigo-700 transition-colors">Sign in here</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Step Components ---
const Step1 = ({ formData, errors, loading, imagePreview, onInputChange, onImageChange, onOAuthClick }) => (
    <div className="space-y-6">
        <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Create Your Account</h2>
            <p className="text-gray-600">Let's get you started with your Tix journey</p>
        </div>

        {/* OAuth Buttons */}
        <div className="space-y-3 mb-6">
            {OAUTH_PROVIDERS.map((provider) => (
                <button
                    key={provider.id}
                    type="button"
                    onClick={() => onOAuthClick(provider.id)}
                    disabled={loading}
                    className={`w-full flex items-center justify-center gap-3 px-6 py-4 rounded-2xl border-2 font-semibold text-base transition-all duration-200 ease-in-out transform hover:scale-[1.02] active:scale-[0.98] ${provider.primary
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-transparent hover:from-indigo-600 hover:to-purple-700 shadow-lg hover:shadow-xl'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-300 hover:bg-gray-50 hover:shadow-md'
                        } ${loading ? 'opacity-70 cursor-not-allowed' : 'hover:shadow-lg'}`}
                >
                    {/* {provider.icon} */}
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

        {/* Profile Image Upload */}
        <div className="flex flex-col items-center justify-center space-y-2">
            <label htmlFor="profileImage" className="cursor-pointer">
                <div className="w-24 h-24 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center transition-all hover:bg-gray-200">
                    {imagePreview ? (
                        <img src={imagePreview} alt="Profile Preview" className="w-full h-full rounded-full object-cover" />
                    ) : (
                        <div className="text-center text-gray-500 p-2">
                            <svg className="mx-auto h-8 w-8 text-gray-400" viewBox="0 0 24 24" fill="currentColor"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" /></svg>
                            <span className="mt-1 block text-xs font-semibold">Upload</span>
                        </div>
                    )}
                </div>
            </label>
            <input id="profileImage" name="profileImage" type="file" className="sr-only" accept="image/*" onChange={onImageChange} />
        </div>

        {/* Form Fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
                <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700 mb-2">First Name</label>
                <input
                    id="firstName"
                    name="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={onInputChange}
                    aria-invalid={!!errors.firstName}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${errors.firstName ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-indigo-300'
                        }`}
                    placeholder="John"
                />
                {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
            </div>
            <div>
                <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700 mb-2">Last Name</label>
                <input
                    id="lastName"
                    name="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={onInputChange}
                    aria-invalid={!!errors.lastName}
                    className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${errors.lastName ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-indigo-300'
                        }`}
                    placeholder="Doe"
                />
                {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
            </div>
        </div>
        <div>
            <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">Email Address</label>
            <input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={onInputChange}
                aria-invalid={!!errors.email}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${errors.email ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-indigo-300'
                    }`}
                placeholder="john@example.com"
            />
            {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
        </div>
        <div>
            <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">Password</label>
            <input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={onInputChange}
                aria-invalid={!!errors.password}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${errors.password ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-indigo-300'
                    }`}
                placeholder="••••••••"
            />
            {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
        </div>
        <div>
            <label htmlFor="confirmPassword" className="block text-sm font-semibold text-gray-700 mb-2">Confirm Password</label>
            <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={onInputChange}
                aria-invalid={!!errors.confirmPassword}
                className={`w-full px-4 py-3 border-2 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors ${errors.confirmPassword ? 'border-red-300 bg-red-50' : 'border-gray-200 focus:border-indigo-300'
                    }`}
                placeholder="••••••••"
            />
            {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
        </div>
    </div>
);

const Step2 = ({ userType, onUserTypeSelect, error }) => (
    <div className="space-y-6">
        <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">How will you use Tix?</h2>
            <p className="text-gray-600">Choose the option that best describes you</p>
        </div>
        <div className="space-y-4">
            {USER_TYPES.map((type) => (
                <div key={type.id} onClick={() => onUserTypeSelect(type.id)} className={`p-6 rounded-2xl border-2 cursor-pointer transition-all duration-200 hover:shadow-lg ${userType === type.id ? 'border-indigo-500 bg-indigo-50 shadow-lg' : 'border-gray-200 hover:border-indigo-200'}`}>
                    <div className="flex items-start gap-4">
                        <div className="text-3xl">{type.icon}</div>
                        <div className="flex-1">
                            <h3 className="font-bold text-lg text-gray-900 mb-2">{type.title}</h3>
                            <p className="text-gray-600 mb-3">{type.description}</p>
                            <div className="flex flex-wrap gap-2">
                                {type.features.map((feature, index) => (
                                    <span key={index} className="px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">{feature}</span>
                                ))}
                            </div>
                        </div>
                        <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${userType === type.id ? 'border-indigo-500' : 'border-gray-300'}`}>
                            {userType === type.id && (<div className="w-3 h-3 bg-indigo-500 rounded-full"></div>)}
                        </div>
                    </div>
                </div>
            ))}
        </div>
        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
    </div>
);

const Step3 = ({ formData, onInterestToggle, onInputChange, errors }) => (
    <div className="space-y-6">
        <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">What interests you?</h2>
            <p className="text-gray-600">Select topics to personalize your experience</p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {INTERESTS.map((interest) => (
                <button type="button" key={interest} onClick={() => onInterestToggle(interest)} className={`p-4 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-md ${formData.interests.includes(interest) ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:border-indigo-200 text-gray-700'}`}>
                    <span className="text-sm font-medium">{interest}</span>
                </button>
            ))}
        </div>
        {errors.interests && <p className="text-red-500 text-sm text-center -mt-2">{errors.interests}</p>}

        <div className="space-y-4 pt-6 border-t border-gray-100">
            <label className="flex items-start gap-3 cursor-pointer">
                <input name="agreeToTerms" type="checkbox" checked={formData.agreeToTerms} onChange={onInputChange} className="mt-1 w-5 h-5 text-indigo-600 border-2 border-gray-300 rounded focus:ring-indigo-500" />
                <span className="text-sm text-gray-700">I agree to the <a href="/terms" className="text-indigo-600 hover:text-indigo-700 font-medium">Terms of Service</a> and <a href="/privacy" className="text-indigo-600 hover:text-indigo-700 font-medium">Privacy Policy</a></span>
            </label>
            {errors.agreeToTerms && <p className="text-red-500 text-sm -mt-2 ml-8">{errors.agreeToTerms}</p>}

            <label className="flex items-start gap-3 cursor-pointer">
                <input name="subscribeNewsletter" type="checkbox" checked={formData.subscribeNewsletter} onChange={onInputChange} className="mt-1 w-5 h-5 text-indigo-600 border-2 border-gray-300 rounded focus:ring-indigo-500" />
                <span className="text-sm text-gray-700">Send me updates about new events and features</span>
            </label>
        </div>
    </div>
);

export default Signup;