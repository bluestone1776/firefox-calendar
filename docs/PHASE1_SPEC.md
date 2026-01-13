# Phase 1 Specification

## Scope

### Authentication & User Roles
- Company email login (domain-based authentication)
- Two user roles:
  - **Admin**: `lenita@firefoxtraining.com.au`
  - **Staff**: `phil@firefoxtraining.com.au`, `sam@firefoxtraining.com.au`, `jessica@firefoxtraining.com.au`, `lisa@firefoxtraining.com.au`, `scott@firefoxtraining.com.au`, `paul@firefoxtraining.com.au`
- Company domain configured via `EXPO_PUBLIC_COMPANY_DOMAIN` environment variable

### Scheduling Features
- **Weekly Hours**: Set repeating weekly working hours
- **Leave/Unavailable**: Mark time periods as unavailable
- **Events**: Create and manage three event types:
  - Meetings
  - Personal events
  - Leave events
- All events include a title field

### Daily View
- Side-by-side employee columns
- Vertical time scroll (timeline)
- Horizontal swipe between employees
- Shaded working hours display
- Time increments: 30-minute intervals

## Constraints

- **Time Granularity**: All scheduling in 30-minute increments
- **Distribution**: Internal testing only
  - iOS: TestFlight
  - Android: Internal testing track
- **Development**: Build from scratch (no existing codebase)

## Configuration

- **Company Domain**: `EXPO_PUBLIC_COMPANY_DOMAIN` environment variable
- **Default Timezone**: `EXPO_PUBLIC_DEFAULT_TZ` environment variable (default: `Australia/Sydney`)
