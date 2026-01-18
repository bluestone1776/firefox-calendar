const DEFAULT_TZ = 'Australia/Brisbane';

// Common timezones
export const COMMON_TIMEZONES = [
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
  { value: 'Australia/Melbourne', label: 'Melbourne (AEST/AEDT)' },
  { value: 'Australia/Brisbane', label: 'Brisbane (AEST)' },
  { value: 'Australia/Perth', label: 'Perth (AWST)' },
  { value: 'Australia/Adelaide', label: 'Adelaide (ACST/ACDT)' },
  { value: 'Australia/Darwin', label: 'Darwin (ACST)' },
  { value: 'Pacific/Auckland', label: 'Auckland (NZST/NZDT)' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Hong_Kong', label: 'Hong Kong (HKT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'America/New_York', label: 'New York (EST/EDT)' },
  { value: 'America/Los_Angeles', label: 'Los Angeles (PST/PDT)' },
  { value: 'America/Chicago', label: 'Chicago (CST/CDT)' },
  { value: 'UTC', label: 'UTC' },
];

/**
 * Get the user's selected timezone or default
 */
export async function getTimezone(): Promise<string> {
  return DEFAULT_TZ;
}

/**
 * Set the user's timezone preference
 */
export async function setTimezone(timezone: string): Promise<void> {
  // Timezone is locked to Brisbane; no-op to preserve callers.
  void timezone;
}

/**
 * Get default timezone (from env or fallback)
 */
export function getDefaultTimezone(): string {
  return DEFAULT_TZ;
}
