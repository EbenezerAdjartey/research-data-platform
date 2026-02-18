import Constants from 'expo-constants';

// In development, use localhost. In production, use the deployed API URL.
// Configure via app.json extra field or environment variable.
const devApiUrl = 'http://localhost:8000/api/v1';

export const API_BASE: string =
  Constants.expoConfig?.extra?.apiUrl ?? devApiUrl;
