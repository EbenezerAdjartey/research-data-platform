import { useEffect, useState } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Alert, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from 'expo-document-picker';
import type { Dataset, AnalysisResult, TokenResponse } from '@rdp/shared-types';
import { API_BASE } from '@/config/api';

async function getToken(): Promise<string | null> {
  const stored = await SecureStore.getItemAsync('rdp_tokens');
  if (!stored) return null;
  const tokens: TokenResponse = JSON.parse(stored);
  return tokens.access_token;
}

export default function ProjectDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const projectId = Number(id);
  const router = useRouter();

  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [analyses, setAnalyses] = useState<AnalysisResult[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [tab, setTab] = useState<'datasets' | 'analyses'>('datasets');

  const fetchData = async () => {
    const token = await getToken();
    if (!token) return;
    const headers = { Authorization: `Bearer ${token}` };

    const [dsRes, anRes] = await Promise.all([
      fetch(`${API_BASE}/datasets/${projectId}`, { headers }),
      fetch(`${API_BASE}/analysis/project/${projectId}`, { headers }),
    ]);

    if (dsRes.ok) setDatasets(await dsRes.json());
    if (anRes.ok) setAnalyses(await anRes.json());
  };

  useEffect(() => { fetchData(); }, [projectId]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const handleUpload = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'text/csv',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
        ],
      });

      if (result.canceled || !result.assets?.length) return;
      const file = result.assets[0];

      setUploading(true);
      const token = await getToken();
      if (!token) return;

      const formData = new FormData();
      formData.append('file', {
        uri: file.uri,
        name: file.name,
        type: file.mimeType || 'application/octet-stream',
      } as any);

      const res = await fetch(`${API_BASE}/datasets/${projectId}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      if (res.ok) {
        Alert.alert('Success', 'File uploaded successfully');
        await fetchData();
      } else {
        Alert.alert('Error', 'Upload failed');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const formatLabel = (type: string) =>
    type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const statusColor = (status: string) => {
    if (status === 'completed') return '#16a34a';
    if (status === 'failed') return '#dc2626';
    return '#d97706';
  };

  return (
    <View style={styles.container}>
      {/* Tab selector */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'datasets' && styles.tabActive]}
          onPress={() => setTab('datasets')}
        >
          <Text style={[styles.tabText, tab === 'datasets' && styles.tabTextActive]}>
            Datasets ({datasets.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'analyses' && styles.tabActive]}
          onPress={() => setTab('analyses')}
        >
          <Text style={[styles.tabText, tab === 'analyses' && styles.tabTextActive]}>
            Analyses ({analyses.length})
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'datasets' ? (
        <>
          <TouchableOpacity style={styles.uploadBtn} onPress={handleUpload} disabled={uploading}>
            {uploading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.uploadText}>Upload File</Text>
            )}
          </TouchableOpacity>

          <FlatList
            data={datasets}
            keyExtractor={(item) => String(item.id)}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>{item.filename}</Text>
                <Text style={styles.cardMeta}>
                  {item.row_count} rows · {item.col_count} columns · {item.format.toUpperCase()}
                </Text>
                <Text style={styles.cardDate}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Text>
              </View>
            )}
            ListEmptyComponent={
              <Text style={styles.empty}>No datasets. Upload a file to get started.</Text>
            }
          />
        </>
      ) : (
        <FlatList
          data={analyses}
          keyExtractor={(item) => String(item.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              onPress={() => router.push(`/(app)/analysis/${item.id}`)}
            >
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{formatLabel(item.analysis_type)}</Text>
                <View style={[styles.badge, { backgroundColor: statusColor(item.status) + '20' }]}>
                  <Text style={[styles.badgeText, { color: statusColor(item.status) }]}>
                    {item.status}
                  </Text>
                </View>
              </View>
              <Text style={styles.cardDate}>
                {new Date(item.created_at).toLocaleString()}
              </Text>
            </TouchableOpacity>
          )}
          ListEmptyComponent={
            <Text style={styles.empty}>No analyses yet. Run one from the web app.</Text>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  tabs: { flexDirection: 'row', marginBottom: 16, backgroundColor: '#e5e7eb', borderRadius: 8 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  tabActive: { backgroundColor: '#2563eb' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#fff' },
  uploadBtn: {
    backgroundColor: '#2563eb', borderRadius: 8, padding: 14,
    alignItems: 'center', marginBottom: 16,
  },
  uploadText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 4, elevation: 2,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4, flex: 1 },
  cardMeta: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  cardDate: { fontSize: 12, color: '#9ca3af' },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  empty: { textAlign: 'center', color: '#9ca3af', marginTop: 40 },
});
