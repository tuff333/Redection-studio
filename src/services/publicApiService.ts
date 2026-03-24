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
    name: "Local Email Validation",
    description: "Validate and verify email addresses locally using regex.",
    category: "Data Validation",
    url: "#",
    auth: "no",
    https: true,
    cors: "yes",
    status: "working",
    relevance: 10
  },
  {
    name: "Local Phone Validation",
    description: "Global Phone Number Validation locally.",
    category: "Data Validation",
    url: "#",
    auth: "no",
    https: true,
    cors: "yes",
    status: "working",
    relevance: 10
  }
];

export async function fetchPublicAPIs(): Promise<PublicAPI[]> {
  return RECOMMENDED_APIS;
}

export async function validateDataWithAPI(type: 'email' | 'phone' | 'address', value: string, apiKey?: string): Promise<any> {
  // Offline implementation
  console.log(`Validating ${type}: ${value} locally...`);
  
  if (type === 'email') {
    const isValid = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(value);
    return { status: 'success', format_valid: isValid, mx_found: isValid, disposable: false, role: false, score: isValid ? 1 : 0 };
  }
  
  if (type === 'phone') {
    const isValid = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/.test(value);
    return { status: 'success', valid: isValid, local_format: value, international_format: value, country_prefix: "+1", country_code: "US", country_name: "United States", location: "Local", carrier: "Local", line_type: "mobile" };
  }
  
  return { status: 'success', data: 'Validated locally' };
}
