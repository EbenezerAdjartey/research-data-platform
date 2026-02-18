import { Stack } from 'expo-router';

export default function AppLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="project/[id]" options={{ title: 'Project', headerBackTitle: 'Back' }} />
      <Stack.Screen name="analysis/[id]" options={{ title: 'Analysis Result', headerBackTitle: 'Back' }} />
    </Stack>
  );
}
