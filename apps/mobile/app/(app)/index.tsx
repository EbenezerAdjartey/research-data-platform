import { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/components/AuthProvider';
import * as SecureStore from 'expo-secure-store';
import type { Project, TokenResponse } from '@rdp/shared-types';
import { API_BASE } from '@/config/api';

export default function DashboardScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchProjects = async () => {
    const stored = await SecureStore.getItemAsync('rdp_tokens');
    if (!stored) return;
    const tokens: TokenResponse = JSON.parse(stored);
    const res = await fetch(`${API_BASE}/projects/`, {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (res.ok) setProjects(await res.json());
  };

  useEffect(() => { fetchProjects(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchProjects();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.name}>{user?.full_name}</Text>
        </View>
        <TouchableOpacity onPress={logout}>
          <Text style={styles.logout}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.sectionTitle}>Your Projects</Text>

      <FlatList
        data={projects}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            onPress={() => router.push(`/(app)/project/${item.id}`)}
          >
            <Text style={styles.cardTitle}>{item.name}</Text>
            {item.description && <Text style={styles.cardDesc}>{item.description}</Text>}
            <Text style={styles.cardDate}>
              Updated {new Date(item.updated_at).toLocaleDateString()}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>No projects yet. Create one on the web app.</Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16, paddingTop: 60 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  greeting: { fontSize: 14, color: '#6b7280' },
  name: { fontSize: 22, fontWeight: 'bold' },
  logout: { color: '#ef4444', fontSize: 14 },
  sectionTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  cardDesc: { fontSize: 14, color: '#6b7280', marginBottom: 8 },
  cardDate: { fontSize: 12, color: '#9ca3af' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
});
