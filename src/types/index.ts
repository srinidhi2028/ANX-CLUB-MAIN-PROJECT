export interface User {
  uid: string;
  email: string;
  fullName: string;
  role: 'Visitor' | 'Member' | 'Mentor' | 'Admin';
  membershipTier?: 'Basic' | 'Premium' | 'Enterprise';
  membershipType?: string; // Matches existing database fields
  status?: 'Active' | 'Expired' | 'Pending';
  joinedDate?: string;
  phoneNumber?: string;
  collegeName?: string;
  yearBranch?: string;
  skills?: string;
  interests?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  portfolioUrl?: string;
}

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time?: string;
  venue?: string;          // Module 4 venue
  location?: string;       // Module 2 location
  price: number;
  premiumPrice?: number;
  capacity?: number;
  seats?: number;          // Module 3 seats limit
  seatsAvailable?: number | null; // Module 4 seats available
  seatsBooked?: number;    // Module 4 seats booked
  hostId?: string;
  organizerId?: string;    // Module 3 organizer
  speaker?: string;        // Module 3 speaker
  speakerName?: string;    // Module 4 speaker
  eventType?: 'free' | 'paid' | 'premium' | 'member-only' | string;
  type?: string;           // Module 3 event type (free/paid/premium)
  memberOnly?: boolean;
  posterUrl?: string;
  onlineLink?: string;
  isActive?: boolean;
  status?: 'Approved' | 'Pending' | string;
  registeredCount?: number;
  registrationDeadline?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Mentor {
  id: string;
  name: string;
  title: string;
  company: string;
  skills: string[];
  rating: number;
  totalReviews: number;
  hourlyRate: number;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  status: string;
  role: string;
  members?: string[];
  userId?: string;
  createdAt?: string;
}
