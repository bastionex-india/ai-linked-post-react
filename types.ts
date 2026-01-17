
export interface Trend {
  id: string;
  topic: string;
  volume: string;
  image?: string;
  source: 'google' | 'manual';
  timestamp: number;
}

export interface LinkedInPost {
  id: string;
  topic: string;
  content: string;
  imageUrl: string;
  status: 'draft' | 'scheduled' | 'posted';
  scheduledTime?: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface AutomationSettings {
  isEnabled: boolean;
  frequency: 'hourly' | 'daily' | 'weekly';
  preferredTime?: string;
  topicKeywords: string[];
}
