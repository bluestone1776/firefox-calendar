import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
      }}
    >
      <Stack.Screen
        name="daily"
        options={{
          title: 'Daily View',
        }}
      />
      <Stack.Screen
        name="weekly"
        options={{
          title: 'Weekly View',
        }}
      />
      <Stack.Screen
        name="event-editor"
        options={{
          title: 'Event Editor',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="settings"
        options={{
          title: 'Settings',
        }}
      />
      <Stack.Screen
        name="weekly-confirmation"
        options={{
          title: 'Weekly Confirmation',
        }}
      />
      <Stack.Screen
        name="payroll-report"
        options={{
          title: 'Payroll Report',
        }}
      />
    </Stack>
  );
}
