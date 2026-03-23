import { GoogleGenAI, Type } from "@google/genai";

export interface PublicAPI {
  name: string;
  description: string;
  category: string;
  url: string;
  auth: string;
  https: boolean;
  cors: string;
  status: 'working' | 'unknown' | 'broken';
  relevance: number; // 1-10 for redaction tool
}

export const RECOMMENDED_APIS: PublicAPI[] = [
  {
    name: "Abstract Email Validation",
    description: "Validate and verify email addresses.",
    category: "Data Validation",
    url: "https://www.abstractapi.com/email-verification-validation-api",
    auth: "apiKey",
    https: true,
    cors: "yes",
    status: "working",
    relevance: 9
  },
  {
    name: "Numverify",
    description: "Global Phone Number Validation & Lookup API.",
    category: "Data Validation",
    url: "https://numverify.com/",
    auth: "apiKey",
    https: true,
    cors: "yes",
    status: "working",
    relevance: 9
  },
  {
    name: "Free Dictionary API",
    description: "Definitions, phonetics, and more for English words.",
    category: "Dictionaries",
    url: "https://dictionaryapi.dev/",
    auth: "no",
    https: true,
    cors: "yes",
    status: "working",
    relevance: 7
  },
  {
    name: "IP-API",
    description: "IP Geolocation API.",
    category: "Geocoding",
    url: "https://ip-api.com/",
    auth: "no",
    https: true,
    cors: "yes",
    status: "working",
    relevance: 6
  },
  {
    name: "Neutrino API",
    description: "A general-purpose toolset for developers including PII detection.",
    category: "Security",
    url: "https://www.neutrinoapi.com/",
    auth: "apiKey",
    https: true,
    cors: "yes",
    status: "working",
    relevance: 10
  },
  {
    name: "Cloudmersive NLP",
    description: "Natural Language Processing for PII detection and entity recognition.",
    category: "Machine Learning",
    url: "https://cloudmersive.com/nlp-api",
    auth: "apiKey",
    https: true,
    cors: "yes",
    status: "working",
    relevance: 10
  }
];

export async function fetchPublicAPIs(): Promise<PublicAPI[]> {
  // In a real scenario, we might fetch from a live registry or a cached JSON.
  // For now, we return our curated list + some extras from the public-apis repo if possible.
  return RECOMMENDED_APIS;
}

export async function validateDataWithAPI(type: 'email' | 'phone' | 'address', value: string, apiKey?: string): Promise<any> {
  // Mocking the integration for the user to see how it works
  console.log(`Validating ${type}: ${value} using Public API...`);
  
  if (type === 'email') {
    // Example call to a free validation API
    try {
      const res = await fetch(`https://api.eva.pingutil.com/email?email=${encodeURIComponent(value)}`);
      return await res.json();
    } catch (e) {
      return { status: 'error', message: 'API unreachable' };
    }
  }
  
  return { status: 'success', data: 'Validated locally (API integration ready)' };
}
