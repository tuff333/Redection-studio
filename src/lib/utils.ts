import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatFileName(originalName: string, pattern: string): string {
  const nameWithoutExt = originalName.replace(/\.[^/.]+$/, "");
  const now = new Date();
  const date = now.toISOString().split('T')[0];
  const time = now.toLocaleTimeString().replace(/:/g, '-');
  
  let newName = pattern
    .replace('{name}', nameWithoutExt)
    .replace('{date}', date)
    .replace('{time}', time);
    
  // Ensure it ends with .pdf
  if (!newName.toLowerCase().endsWith('.pdf')) {
    newName += '.pdf';
  }
  
  return newName;
}
