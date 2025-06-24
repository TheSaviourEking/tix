import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { insertEventSchema, insertTicketTypeSchema } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { CheckCircle, Plus, Trash2 } from "lucide-react";
import { z } from "zod";
import { uploadImage } from "@/lib/imageUpload";
import { navigate } from "wouter/use-browser-location";
import { Link } from "wouter";

// Step 1 schema (Basic Info and Date & Time)
const step1Schema = insertEventSchema
  .pick({
    title: true,
    description: true,
    shortDescription: true,
    category: true,
    status: true,
  })
  .extend({
    startDate: z.string().min(1, "Start date is required").regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    endDate: z.string().min(1, "End date is required").regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    startTime: z.string().min(1, "Start time is required").regex(/^\d{2}:\d{2}$/, "Invalid time format"),
    endTime: z.string().min(1, "End time is required").regex(/^\d{2}:\d{2}$/, "Invalid time format"),
    image: z.instanceof(File).optional().nullable(),
  });

// Step 2 schema (Location & Tickets, includes Step 1)
const step2Schema = step1Schema.extend({
  id: z.string().optional(),
  organizerId: z.string().optional(),
  isVirtual: z.boolean(),
  virtualLink: z.string().optional(),
  location: z.string().optional(),
  venue: z.string().optional(),
  maxAttendees: z
    .number()
    .optional()
    .transform((val) => (val ? Number(val) : null))
    .refine((val) => val === null || (typeof val === "number" && val > 0), {
      message: "Maximum attendees must be a positive number or empty",
    }),
}).superRefine(({ isVirtual, virtualLink, location }, ctx) => {
  const issues: { path: string; message: string }[] = [];
  if (isVirtual && (!virtualLink || !virtualLink.trim())) {
    issues.push({
      path: "virtualLink",
      message: "Virtual link is required for virtual events",
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Virtual link is required for virtual events",
      path: ["virtualLink"],
    });
  }
  if (!isVirtual && (!location || !location.trim())) {
    issues.push({
      path: "location",
      message: "Location is required for in-person events",
    });
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Location is required for in-person events",
      path: ["location"],
    });
  }
  console.log('SuperRefine Validation:', { isVirtual, virtualLink, location, issues });
});

const ticketFormSchema = insertTicketTypeSchema.extend({
  id: z.string().optional(),
  price: z.string().transform((val) => (val === "" ? 0 : parseFloat(val) || 0)),
  quantity: z.string().transform((val) => (val === "" ? 1 : parseInt(val) || 1)),
});

type EventFormData = z.infer<typeof step2Schema>;
type TicketFormData = z.infer<typeof ticketFormSchema>;

interface EventFormProps {
  onSuccess?: (eventId: string) => void;
  isEditMode: boolean;
  eventId: string | null;
}

const validateTickets = (tickets: TicketFormData[]): string[] => {
  const errors: string[] = [];
  tickets.forEach((ticket, index) => {
    if (!ticket.name.trim()) {
      errors.push(`Ticket ${index + 1}: Name is required`);
    }
    if (parseFloat(String(ticket.price)) < 0) {
      errors.push(`Ticket ${index + 1}: Price cannot be negative`);
    }
    if (parseInt(String(ticket.quantity)) < 1) {
      errors.push(`Ticket ${index + 1}: Quantity must be at least 1`);
    }
  });
  console.log('Ticket Validation Errors:', errors);
  return errors;
};

const validateDateTime = (startDate: string, endDate: string, startTime: string, endTime: string): string | null => {
  if (!startDate) return logError("Start date is required");
  if (!endDate) return logError("End date is required");
  if (!startTime) return logError("Start time is required");
  if (!endTime) return logError("End time is required");

  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
    return logError("Invalid date format");
  }
  if (!/^\d{2}:\d{2}$/.test(startTime) || !/^\d{2}:\d{2}$/.test(endTime)) {
    return logError("Invalid time format");
  }

  const startDateTime = new Date(`${startDate}T${startTime}:00.000+01:00`);
  const endDateTime = new Date(`${endDate}T${endTime}:00.000+01:00`);

  if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
    return logError("Invalid date or time format");
  }

  if (startDateTime >= endDateTime) {
    return logError("Start date/time must be before end date/time");
  }

  if (startDateTime < new Date()) {
    return logError("Start date/time cannot be in the past");
  }

  return null;

  function logError(message: string): string {
    console.log('DateTime Validation Error:', { message, startDate, endDate, startTime, endTime });
    return message;
  }
};

export default function EventForm({ onSuccess, isEditMode, eventId }: EventFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [resolverKey, setResolverKey] = useState(`step1-${Date.now()}`);
  const [internalEventId, setInternalEventId] = useState<string | null>(eventId);
  const [tickets, setTickets] = useState<TicketFormData[]>([
    { name: "General Admission", description: "", price: "0", quantity: "100" },
  ]);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imagePublicId, setImagePublicId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: eventData, isLoading } = useQuery({
    queryKey: { key: "/api/events", id: eventId },
    queryFn: async () => {
      if (!eventId) return null;
      const response = await apiRequest("GET", `/api/events/${eventId}`);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Event Fetch Error:', errorData);
        throw new Error(`Failed to fetch event: ${errorData.message || response.status}`);
      }
      return response.json();
    },
    enabled: !!eventId && isEditMode,
  });

  const { data: ticketsData } = useQuery({
    queryKey: { type: "/api/events", id: eventId, subType: "tickets" },
    queryFn: async () => {
      if (!eventId) return [];
      const response = await apiRequest("GET", `/api/events/${eventId}/tickets`);
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Ticket Fetch Error:', errorData);
        throw new Error(`Failed to fetch tickets: ${errorData.message || response.status}`);
      }
      return response.json();
    },
    enabled: !!eventId && isEditMode,
  });

  const form = useForm<EventFormData>({
    resolver: zodResolver(currentStep === 1 ? step1Schema : step2Schema),
    mode: "onChange",
    defaultValues: {
      title: "",
      description: "",
      shortDescription: "",
      category: "",
      location: "",
      venue: "",
      startDate: new Date().toISOString().split("T")[0],
      endDate: new Date().toISOString().split("T")[0],
      startTime: "09:00",
      endTime: "17:00",
      isVirtual: false,
      virtualLink: "",
      maxAttendees: undefined,
      status: "draft",
      image: null,
    },
    key: resolverKey,
  });

  // Update resolver when currentStep changes
  useEffect(() => {
    const currentValues = form.getValues();
    setResolverKey(`step${currentStep}-${Date.now()}`);
    form.reset(currentValues, {
      keepValues: true,
      keepDirty: true,
      keepTouched: true,
      keepErrors: false,
    });
    form.trigger().then(() => {
      console.log('Form Revalidation:', {
        isValid: form.formState.isValid,
        errors: form.formState.errors,
        values: form.getValues(),
        currentStep,
        resolverKey,
      });
    });
  }, [currentStep, form]);

  useEffect(() => {
    if (eventData && isEditMode) {
      const startDateTime = new Date(eventData.startDate);
      const endDateTime = new Date(eventData.endDate);
      form.reset({
        ...eventData,
        startDate: startDateTime.toISOString().split("T")[0],
        endDate: endDateTime.toISOString().split("T")[0],
        startTime: startDateTime.toTimeString().slice(0, 5),
        endTime: endDateTime.toTimeString().slice(0, 5),
        maxAttendees: eventData.maxAttendees || undefined,
        image: null,
        virtualLink: eventData.virtualLink || "",
        location: eventData.location || "",
      });
      setImagePreview(eventData.image_url || null);
      setImagePublicId(eventData.image_public_id || null);
      console.log('Event Data Loaded:', eventData);
    }
    if (ticketsData && isEditMode) {
      setTickets(
        ticketsData.map((ticket: any) => ({
          id: ticket.id,
          name: ticket.name,
          description: ticket.description || "",
          price: ticket.price.toString(),
          quantity: ticket.quantity.toString(),
        }))
      );
      console.log('Tickets Data Loaded:', ticketsData);
    }
  }, [eventData, ticketsData, isEditMode, form]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/gif'];
      const maxSize = 5 * 1024 * 1024; // 5MB

      if (!validTypes.includes(file.type)) {
        console.log('Image Validation Error:', { fileType: file.type, validation: "Invalid type" });
        toast({
          title: "Invalid file type",
          description: "Please upload a JPEG, PNG, or GIF image",
          variant: "destructive",
        });
        return;
      }

      if (file.size > maxSize) {
        console.log('Image Validation Error:', { fileSize: file.size, maxSize });
        toast({
          title: "File too large",
          description: "Image must be less than 5MB",
          variant: "destructive",
        });
        return;
      }

      setIsUploading(true);
      try {
        form.setValue('image', file);
        setImagePreview(URL.createObjectURL(file));
        console.log('Image Selected:', { fileName: file.name, fileSize: file.size });
        await form.trigger('image');
      } catch (error) {
        console.error('Image Processing Error:', error);
        toast({
          title: "Image processing error",
          description: "Failed to process image",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
      }
    } else {
      form.setValue('image', null);
      console.log('Image Selected: None');
    }
  };

  const publishEventMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const response = await apiRequest("PUT", `/api/events/${eventId}`, { status: "published" });
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Publish Event Error:', errorData);
        throw new Error(`Failed to publish event: ${errorData.message || response.status}`);
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Event published!",
        description: "Your event is now live and visible to attendees.",
      });
      queryClient.invalidateQueries({ queryKey: "/api/events" });
      if (internalEventId) onSuccess?.(internalEventId);
      console.log('Event Published:', { eventId: internalEventId });
    },
    onError: (error: Error) => {
      console.error('Publish Error:', error);
      toast({
        title: "Error publishing event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      console.log('Creating Event:', data);
      const ticketErrors = validateTickets(tickets);
      if (ticketErrors.length > 0) {
        console.log('Ticket Validation Errors:', ticketErrors);
        throw new Error(`Ticket validation failed: ${ticketErrors.join(", ")}`);
      }

      const { startDate, endDate, startTime, endTime, image } = data;
      const dateTimeError = validateDateTime(startDate, endDate, startTime, endTime);
      if (dateTimeError) {
        console.log('DateTime Validation Error:', dateTimeError);
        throw new Error(`Date/time validation failed: ${dateTimeError}`);
      }

      let imageUrl = null;
      let imagePublicId = null;
      if (image) {
        setIsUploading(true);
        try {
          const result = await uploadImage(image);
          imageUrl = result.url;
          imagePublicId = result.publicId;
        } catch (error) {
          console.error('Image Upload Error:', error);
          throw new Error(`Failed to upload image: ${error.message || 'Unknown error'}`);
        } finally {
          setIsUploading(false);
        }
      }

      const startDateTime = new Date(`${startDate}T${startTime}:00.000+01:00`);
      const endDateTime = new Date(`${endDate}T${endTime}:00.000+01:00`);

      const eventPayload = {
        ...data,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        maxAttendees: data.maxAttendees ? Number(data.maxAttendees) : null,
        location: data.isVirtual ? null : data.location,
        venue: data.isVirtual ? null : data.venue,
        image_url: imageUrl,
        imageUrl,
        image_public_id: imagePublicId,
      };

      const eventResponse = await apiRequest("POST", "/api/events", eventPayload);
      if (!eventResponse.ok) {
        const errorData = await eventResponse.json();
        console.error('Event Creation Error:', errorData);
        throw new Error(`${eventResponse.status}: ${JSON.stringify(errorData)}`);
      }

      const event = await eventResponse.json();
      console.log('Event Created:', event);

      const ticketPromises = tickets.map(async (ticket, index) => {
        const ticketPayload = {
          name: ticket.name.trim(),
          description: ticket.description.trim(),
          price: String(parseFloat(String(ticket.price))),
          quantity: parseInt(String(ticket.quantity)),
        };
        console.log(`Creating Ticket ${index + 1}:`, ticketPayload);
        const ticketResponse = await apiRequest("POST", `/api/events/${event.id}/tickets`, ticketPayload);
        if (!ticketResponse.ok) {
          const errorData = await ticketResponse.json();
          console.error(`Ticket ${index + 1} Creation Error:`, errorData);
          throw new Error(`Failed to create ticket: ${errorData.message || ticketResponse.status}`);
        }
        return ticketResponse.json();
      });

      await Promise.all(ticketPromises);
      setInternalEventId(event.id);
      setImagePublicId(imagePublicId);
      setCurrentStep(3);
      return event;
    },
    onSuccess: (event) => {
      toast({
        title: "Event created successfully!",
        description: "Your event has been created with all ticket types.",
      });
      queryClient.invalidateQueries({ queryKey: "/api/events" });
      form.reset();
      setTickets([{ name: "General Admission", description: "", price: "0", quantity: "100" }]);
      setImagePreview(null);
      setImagePublicId(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onSuccess?.(event.id);
      console.log('Event Creation Success:', event);
    },
    onError: (error: Error) => {
      console.error('Create Event Error:', error);
      toast({
        title: "Error creating event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateEventMutation = useMutation({
    mutationFn: async (data: EventFormData) => {
      if (!internalEventId) {
        console.error('Update Event Error: Missing event ID');
        throw new Error("Event ID is required for updates");
      }

      console.log('Updating Event:', data);
      const ticketErrors = validateTickets(tickets);
      if (ticketErrors.length > 0) {
        console.log('Ticket Validation Errors:', ticketErrors);
        throw new Error(`Ticket validation failed: ${ticketErrors.join(", ")}`);
      }

      const { startDate, endDate, startTime, endTime, image } = data;
      const dateTimeError = validateDateTime(startDate, endDate, startTime, endTime);
      if (dateTimeError) {
        console.log('DateTime Validation Error:', dateTimeError);
        throw new Error(`Date/time validation error: ${dateTimeError}`);
      }

      let imageUrl = data.image_url ?? null;
      let newImagePublicId = imagePublicId;
      if (image) {
        setIsUploading(true);
        try {
          if (data.image_public_id) {
            console.log('Deleting Old Image:', data.image_public_id);
            await apiRequest('DELETE', `/api/delete-image/${encodeURIComponent(data.image_public_id)}`);
          }
          const result = await uploadImage(image);
          imageUrl = result.url;
          newImagePublicId = result.publicId;
          console.log('New Image Uploaded:', { url: imageUrl, publicId: newImagePublicId });
        } catch (error) {
          console.error('Image Upload Error:', error);
          throw new Error(`Failed to upload image: ${error.message || 'Unknown error'}`);
        } finally {
          setIsUploading(false);
        }
      }

      const startDateTime = new Date(`${startDate}T${startTime}:00.000+01:00`);
      const endDateTime = new Date(`${endDate}T${endTime}:00.000+01:00`);

      const eventPayload = {
        ...data,
        startDate: startDateTime.toISOString(),
        endDate: endDateTime.toISOString(),
        maxAttendees: data.maxAttendees ? Number(data.maxAttendees) : null,
        location: data.isVirtual ? null : data.location,
        venue: data.isVirtual ? null : data.venue,
        image_url: imageUrl,
        image_public_id: newImagePublicId,
      };

      console.log('Event Update Payload:', eventPayload);
      const eventResponse = await apiRequest("PUT", `/api/events/${internalEventId}`, eventPayload);
      if (!eventResponse.ok) {
        const errorData = await eventResponse.json();
        console.error('Event Update Error:', errorData);
        throw new Error(`${eventResponse.status}: ${JSON.stringify(errorData)}`);
      }

      const event = await eventResponse.json();
      console.log('Event Updated:', event);

      const existingTicketIds = ticketsData?.map((t: any) => t.id) || [];
      const currentTicketIds = tickets.filter((t) => t.id).map((t) => t.id);
      const deletedTicketIds = existingTicketIds.filter((id) => !currentTicketIds.includes(id));

      const deletePromises = deletedTicketIds.map(async (ticketId) => {
        console.log('Deleting Ticket:', ticketId);
        const response = await apiRequest("DELETE", `/api/tickets/${ticketId}`);
        if (!response.ok) {
          const errorData = await response.json();
          console.error('Ticket Deletion Error:', errorData);
          throw new Error(`Failed to delete ticket: ${errorData.message || response.status}`);
        }
      });

      const ticketPromises = tickets.map(async (ticket, index) => {
        const ticketPayload = {
          name: ticket.name.trim(),
          description: ticket.description.trim(),
          price: String(parseFloat(String(ticket.price))),
          quantity: parseInt(String(ticket.quantity)),
        };
        if (ticket.id) {
          console.log(`Updating Ticket ${index + 1}:`, ticketPayload);
          const response = await apiRequest("PATCH", `/api/tickets/${ticket.id}`, ticketPayload);
          if (!response.ok) {
            const errorData = await response.json();
            console.error(`Ticket ${index + 1} Update Error:`, errorData);
            throw new Error(`Failed to update ticket: ${errorData.message || response.status}`);
          }
          return response.json();
        } else {
          console.log(`Creating Ticket ${index + 1}:`, ticketPayload);
          const response = await apiRequest("POST", `/api/events/${internalEventId}/tickets`, ticketPayload);
          if (!response.ok) {
            const errorData = await response.json();
            console.error(`Ticket ${index + 1} Creation Error:`, errorData);
            throw new Error(`Failed to create ticket: ${errorData.message || response.status}`);
          }
          return response.json();
        }
      });

      await Promise.all([...deletePromises, ...ticketPromises]);
      setImagePublicId(newImagePublicId);
      setCurrentStep(3);
      return event;
    },
    onSuccess: (event) => {
      toast({
        title: "Event updated successfully!",
        description: "Your event and ticket types have been updated.",
      });
      queryClient.invalidateQueries({ queryKey: "/api/events" });
      if (internalEventId) onSuccess?.(internalEventId);
      console.log('Event Update Success:', event);
    },
    onError: (error: Error) => {
      console.error('Update Event Error:', error);
      toast({
        title: "Error updating event",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: EventFormData) => {
    console.log('Form Submitted:', data);
    const ticketErrors = validateTickets(tickets);
    if (ticketErrors.length > 0) {
      console.log('Ticket Validation Errors:', ticketErrors);
      toast({
        title: "Validation Error",
        description: ticketErrors.join(", "),
        variant: "destructive",
      });
      return;
    }

    if (isEditMode && internalEventId) {
      updateEventMutation.mutate(data);
    } else {
      createEventMutation.mutate(data);
    }
  };

  const addTicket = () => {
    setTickets([...tickets, { name: "", description: "", price: "0", quantity: "100" }]);
    console.log('Added New Ticket');
  };

  const removeTicket = (index: number) => {
    if (tickets.length > 1) {
      setTickets(tickets.filter((_, i) => i !== index));
      console.log('Removed Ticket at Index:', index);
    } else {
      console.log('Cannot Remove Last Ticket');
      toast({
        title: "Cannot remove ticket",
        description: "At least one ticket type is required",
        variant: "destructive",
      });
    }
  };

  const updateTicket = (index: number, field: keyof TicketFormData, value: string) => {
    if (field === "price" && value !== "" && (isNaN(parseFloat(value)) || parseFloat(value) < 0)) {
      console.log('Invalid Ticket Price:', { index, value });
      return;
    }
    if (field === "quantity" && value !== "" && (isNaN(parseInt(value)) || parseInt(value) < 1)) {
      console.log('Invalid Ticket Quantity:', { index, value });
      return;
    }
    const newTickets = [...tickets];
    newTickets[index] = { ...newTickets[index], [field]: value };
    setTickets(newTickets);
    console.log('Updated Ticket:', { index, field, value });
  };

  const categories = [
    { value: "music", label: "Music" },
    { value: "tech", label: "Technology" },
    { value: "business", label: "Business" },
    { value: "fitness", label: "Fitness" },
    { value: "food", label: "Food & Drink" },
    { value: "education", label: "Education" },
    { value: "arts", label: "Arts & Culture" },
    { value: "nature", label: "Nature & Outdoors" },
  ];

  const steps = [
    { id: 1, label: "Basic Info" },
    { id: 2, label: "Location & Tickets" },
    { id: 3, label: isEditMode ? "Save & Publish" : "Publish" },
  ];

  const handleStepChange = async (step: number) => {
    if (step === 1) {
      setCurrentStep(1);
      console.log('Navigated to Step 1');
    } else if (step === 2) {
      const { startDate, endDate, startTime, endTime } = form.getValues();
      await form.trigger();
      const dateTimeError = validateDateTime(startDate, endDate, startTime, endTime);
      console.log('Step Change to 2:', {
        isValid: form.formState.isValid,
        errors: form.formState.errors,
        dateTimeError,
        formValues: form.getValues(),
      });
      if (!form.formState.isValid) {
        console.log('Step 2 Blocked: Form Invalid', form.formState.errors);
        toast({
          title: "Validation Error",
          description: "Please complete all required fields in Basic Info.",
          variant: "destructive",
        });
      } else if (dateTimeError) {
        console.log('Step 2 Blocked: DateTime Error', dateTimeError);
        toast({
          title: "Validation Error",
          description: dateTimeError,
          variant: "destructive",
        });
      } else {
        setCurrentStep(2);
        console.log('Navigated to Step 2');
      }
    } else if (step === 3 && (internalEventId || isEditMode)) {
      setCurrentStep(3);
      console.log('Navigated to Step 3');
    } else {
      console.log('Step Navigation Blocked:', { step, internalEventId, isEditMode });
      toast({
        title: "Cannot skip steps",
        description: "Please complete the current step before proceeding.",
        variant: "destructive",
      });
    }
  };

  const handleNextStep = async () => {
    const { startDate, endDate, startTime, endTime } = form.getValues();
    await form.trigger();
    const dateTimeError = validateDateTime(startDate, endDate, startTime, endTime);
    console.log('Next Step Clicked:', {
      isValid: form.formState.isValid,
      errors: form.formState.errors,
      dateTimeError,
      formValues: form.getValues(),
    });
    if (!form.formState.isValid) {
      console.log('Next Step Blocked: Form Invalid', form.formState.errors);
      toast({
        title: "Validation Error",
        description: "Please complete all required fields in Basic Info.",
        variant: "destructive",
      });
    } else if (dateTimeError) {
      console.log('Next Step Blocked: DateTime Error', dateTimeError);
      toast({
        title: "Validation Error",
        description: dateTimeError,
        variant: "destructive",
      });
    } else {
      setCurrentStep(2);
      console.log('Proceeded to Step 2');
    }
  };

  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
        console.log('Cleaned up Image Preview URL');
      }
    };
  }, [imagePreview]);

  const renderStepIndicator = () => (
    <div className="flex justify-between mb-8">
      {steps.map((step) => (
        <button
          key={step.id}
          type="button"
          onClick={() => handleStepChange(step.id)}
          className={`flex items-center space-x-2 px-4 py-2 rounded-md transition-colors ${currentStep === step.id
            ? "bg-primary text-primary-foreground"
            : currentStep > step.id
              ? "bg-green-100 text-green-800"
              : "bg-gray-100 text-gray-600"
            } ${step.id > 1 &&
              (!form.formState.isValid ||
                validateDateTime(
                  form.getValues().startDate,
                  form.getValues().endDate,
                  form.getValues().startTime,
                  form.getValues().endTime
                ))
              ? "cursor-not-allowed opacity-50"
              : ""
            } ${step.id === 3 && !internalEventId && !isEditMode ? "cursor-not-allowed opacity-50" : ""}`}
          disabled={
            (step.id === 2 &&
              (!form.formState.isValid ||
                !!validateDateTime(
                  form.getValues().startDate,
                  form.getValues().endDate,
                  form.getValues().startTime,
                  form.getValues().endTime
                ))) ||
            (step.id === 3 && !internalEventId && !isEditMode)
          }
        >
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center ${currentStep === step.id
              ? "bg-white text-primary"
              : currentStep > step.id
                ? "bg-green-500 text-white"
                : "bg-gray-300 text-gray-600"
              }`}
          >
            {currentStep > step.id ? <CheckCircle className="w-4 h-4" /> : step.id}
          </span>
          <span>{step.label}</span>
        </button>
      ))}
    </div>
  );

  // Debug component to display form state
  const renderDebugInfo = () => {
    const { isVirtual, virtualLink, location } = form.getValues();
    const superRefineErrors: { path: string; message: string }[] = [];
    if (currentStep === 2) {
      if (isVirtual && (!virtualLink || !virtualLink.trim())) {
        superRefineErrors.push({
          path: "virtualLink",
          message: "Virtual link is required for virtual events",
        });
      }
      if (!isVirtual && (!location || !location.trim())) {
        superRefineErrors.push({
          path: "location",
          message: "Location is required for in-person events",
        });
      }
    }

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Debug Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <p><strong>Current Step:</strong> {currentStep}</p>
            <p><strong>Resolver Key:</strong> {resolverKey}</p>
            <p><strong>Form Valid:</strong> {form.formState.isValid.toString()}</p>
            <p><strong>Form Errors:</strong> {JSON.stringify(form.formState.errors, null, 2)}</p>
            <p><strong>SuperRefine Errors:</strong> {JSON.stringify(superRefineErrors, null, 2)}</p>
            <p><strong>Form Values:</strong> {JSON.stringify(form.getValues(), null, 2)}</p>
            <p><strong>DateTime Validation:</strong> {validateDateTime(
              form.getValues().startDate,
              form.getValues().endDate,
              form.getValues().startTime,
              form.getValues().endTime
            ) || "Valid"}</p>
            <p><strong>Button Disabled:</strong> {(
              !form.formState.isValid ||
              !!validateDateTime(
                form.getValues().startDate,
                form.getValues().endDate,
                form.getValues().startTime,
                form.getValues().endTime
              )
            ).toString()}</p>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await form.trigger();
                console.log('Manual Validation:', {
                  isValid: form.formState.isValid,
                  errors: form.formState.errors,
                  values: form.getValues(),
                  currentStep,
                  resolverKey,
                });
                toast({
                  title: "Validation Result",
                  description: form.formState.isValid
                    ? "Form is valid!"
                    : "Form is invalid. Check debug info for errors.",
                  variant: form.formState.isValid ? "default" : "destructive",
                });
              }}
            >
              Validate Form
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderStep = () => {
    if (isLoading) {
      return <div>Loading event data...</div>;
    }

    switch (currentStep) {
      case 1:
        return (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Title *</FormLabel>
                      <FormControl>
                        <Input placeholder="Enter event title" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="image"
                  render={() => (
                    <FormItem>
                      <FormLabel>Event Image</FormLabel>
                      <FormControl>
                        <div className="space-y-4">
                          {imagePreview && (
                            <div className="relative w-full max-w-xs">
                              <img
                                src={imagePreview}
                                alt="Event preview"
                                className="w-full h-auto rounded-lg"
                              />
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                className="absolute top-2 right-2"
                                onClick={() => {
                                  form.setValue('image', null);
                                  setImagePreview(null);
                                  setImagePublicId(null);
                                  if (fileInputRef.current) fileInputRef.current.value = '';
                                  console.log('Image Removed');
                                }}
                              >
                                Remove
                              </Button>
                            </div>
                          )}
                          <Input
                            type="file"
                            accept="image/jpeg,image/png,image/gif"
                            ref={fileInputRef}
                            onChange={handleImageChange}
                            disabled={isUploading}
                          />
                          {isUploading && <p className="text-sm text-muted-foreground">Uploading image...</p>}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="shortDescription"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Short Description</FormLabel>
                      <FormControl>
                        <Input placeholder="Brief summary of your event" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full Description *</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Provide a detailed description of your event"
                          className="min-h-[120px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Category *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a category" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.value} value={category.value}>
                              {category.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Date & Time</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            min={new Date().toISOString().split("T")[0]}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="startTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Time *</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date *</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            min={form.watch("startDate") || new Date().toISOString().split("T")[0]}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Time *</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* {renderDebugInfo()} */}

            <div className="flex gap-4">
              <Button
                type="button"
                onClick={handleNextStep}
                disabled={
                  !form.formState.isValid ||
                  !!validateDateTime(
                    form.getValues().startDate,
                    form.getValues().endDate,
                    form.getValues().startTime,
                    form.getValues().endTime
                  )
                }
                className="flex-1"
              >
                Next: Location & Tickets
              </Button>
            </div>
          </>
        );

      case 2:
        return (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Location</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="isVirtual"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Virtual Event</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          This event will be held online
                        </div>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                {form.watch("isVirtual") ? (
                  <FormField
                    control={form.control}
                    name="virtualLink"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Virtual Event Link *</FormLabel>
                        <FormControl>
                          <Input placeholder="https://zoom.us/..." type="url" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ) : (
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="venue"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Venue Name</FormLabel>
                          <FormControl>
                            <Input placeholder="Conference Center, Park, etc." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="location"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Address *</FormLabel>
                          <FormControl>
                            <Input placeholder="Street address, city, state" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                )}

                <FormField
                  control={form.control}
                  name="maxAttendees"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Attendees</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="Leave empty for unlimited"
                          min="1"
                          value={field.value ?? ""}
                          onChange={(e) => {
                            const value = e.target.value;
                            field.onChange(value ? Number(value) : null);
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  Ticket Types
                  <Button type="button" variant="outline" size="sm" onClick={addTicket}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Ticket Type
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {tickets.map((ticket, index) => (
                  <div key={ticket.id || index} className="border rounded-lg p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">Ticket Type {index + 1}</h4>
                      {tickets.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTicket(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`ticket-name-${index}`}>Ticket Name *</Label>
                        <Input
                          id={`ticket-name-${index}`}
                          placeholder="General Admission"
                          value={ticket.name}
                          onChange={(e) => updateTicket(index, "name", e.target.value)}
                          className={!ticket.name.trim() ? "border-red-300" : ""}
                        />
                        {!ticket.name.trim() && (
                          <p className="text-sm text-red-600 mt-1">Ticket name is required</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`ticket-price-${index}`}>Price ($)</Label>
                        <Input
                          id={`ticket-price-${index}`}
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={ticket.price}
                          onChange={(e) => updateTicket(index, "price", e.target.value)}
                        />
                        {parseFloat(String(ticket.price)) < 0 && (
                          <p className="text-sm text-red-600 mt-1">Price cannot be negative</p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`ticket-quantity-${index}`}>Available Quantity *</Label>
                        <Input
                          id={`ticket-quantity-${index}`}
                          type="number"
                          min="1"
                          placeholder="100"
                          value={ticket.quantity}
                          onChange={(e) => updateTicket(index, "quantity", e.target.value)}
                        />
                        {parseInt(String(ticket.quantity)) < 1 && (
                          <p className="text-sm text-red-600 mt-1">Quantity must be at least 1</p>
                        )}
                      </div>
                    </div>

                    <div>
                      <Label htmlFor={`ticket-description-${index}`}>Description</Label>
                      <Textarea
                        id={`ticket-description-${index}`}
                        placeholder="Optional description for this ticket type"
                        value={ticket.description}
                        onChange={(e) => updateTicket(index, "description", e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <div className="flex gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setCurrentStep(1)}
                className="flex-1"
              >
                Back
              </Button>
              <Button
                type="submit"
                disabled={createEventMutation.isPending || updateEventMutation.isPending || isUploading}
                className="flex-1"
              >
                {isEditMode
                  ? updateEventMutation.isPending
                    ? "Updating Event..."
                    : "Update Event"
                  : createEventMutation.isPending
                    ? "Creating Event..."
                    : "Create Event"}
              </Button>
            </div>
          </>
        );

      case 3:
        return (
          <Card>
            <CardHeader>
              <CardTitle>{isEditMode ? "Event Updated!" : "Event Created!"}</CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
              <p className="text-lg">
                Your event has been successfully {isEditMode ? "updated" : "created as a draft"}.
              </p>
              <p className="text-muted-foreground">
                You can publish your event now to make it visible to attendees, or save it as a draft
                to edit later.
              </p>
              <div className="flex gap-4 justify-center">
                <Link href="/">
                  <Button
                    disabled={publishEventMutation.isPending || !internalEventId}
                  >
                    {/* {publishEventMutation.isPending ? "Publishing..." : "Publish Event"} */}
                    Go Home
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => {
                    form.reset();
                    setTickets([{ name: "General Admission", description: "", price: "0", quantity: "100" }]);
                    setCurrentStep(1);
                    setInternalEventId(null);
                    setImagePreview(null);
                    setImagePublicId(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    console.log('Reset Form for New Event');
                  }}
                >
                  Create Another Event
                </Button>
                <Button
                  onClick={() => {
                    if (internalEventId) {
                      publishEventMutation.mutate(internalEventId);
                    }
                  }}
                  disabled={publishEventMutation.isPending || !internalEventId}
                >
                  {publishEventMutation.isPending ? "Publishing..." : "Publish Event"}
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  return (
    <Form {...form}>
      {renderStepIndicator()}
      {/* {Object.entries(form.formState.errors).length > 0 && (
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 mb-6">
          <h3 className="font-bold">Please fix the following errors:</h3>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            {Object.entries(form.formState.errors).map(([key, error]) => (
              <li key={key}>{error?.message}</li>
            ))}
          </ul>
        </div>
      )} */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          form.handleSubmit(onSubmit)(e);
        }}
        className="space-y-8"
      >
        {renderStep()}
      </form>
    </Form>
  );
}