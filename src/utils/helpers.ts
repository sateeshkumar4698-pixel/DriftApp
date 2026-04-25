export function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return formatDate(timestamp);
}

/**
 * Normalises any Indian phone input to E.164 (+91XXXXXXXXXX).
 * Accepts: "9876543210", "09876543210", "+919876543210", "91 98765 43210", etc.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, ''); // strip everything non-digit
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('091')) return `+91${digits.slice(3)}`;
  // If the original had a leading '+', trust it as-is
  const trimmed = phone.trim();
  if (trimmed.startsWith('+')) return trimmed.replace(/\s/g, '');
  return `+91${digits}`;
}

/** Validates an Indian E.164 number: +91 followed by exactly 10 digits */
export function validatePhone(phone: string): boolean {
  return /^\+91[6-9]\d{9}$/.test(phone);
}

/** Formats a 10-digit string as "98765 43210" for display */
export function formatIndianNumber(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 10);
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)} ${d.slice(5)}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function generateMatchId(uid1: string, uid2: string): string {
  return [uid1, uid2].sort().join('_');
}
