import { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as SecureStore from 'expo-secure-store';
import type { AnalysisResult, TokenResponse } from '@rdp/shared-types';
import { API_BASE } from '@/config/api';

const formatLabel = (s: string) =>
  s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

function ResultValue({ label, value }: { label: string; value: unknown }) {
  if (value === null || value === undefined) return null;

  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);

    // Check if nested table
    const firstVal = obj[keys[0]];
    if (typeof firstVal === 'object' && firstVal !== null && !Array.isArray(firstVal)) {
      const innerKeys = Object.keys(firstVal as Record<string, unknown>);
      return (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{formatLabel(label)}</Text>
          <ScrollView horizontal>
            <View>
              <View style={styles.tableRow}>
                <Text style={[styles.tableCell, styles.tableHeader, { minWidth: 100 }]}>Variable</Text>
                {innerKeys.map((k) => (
                  <Text key={k} style={[styles.tableCell, styles.tableHeader]}>{formatLabel(k)}</Text>
                ))}
              </View>
              {keys.map((rowKey) => {
                const row = obj[rowKey] as Record<string, unknown>;
                return (
                  <View key={rowKey} style={styles.tableRow}>
                    <Text style={[styles.tableCell, { minWidth: 100, fontWeight: '600' }]}>{rowKey}</Text>
                    {innerKeys.map((k) => (
                      <Text key={k} style={styles.tableCell}>
                        {typeof row[k] === 'number' ? (row[k] as number).toFixed(4) : String(row[k] ?? '')}
                      </Text>
                    ))}
                  </View>
                );
              })}
            </View>
          </ScrollView>
        </View>
      );
    }

    // Simple key-value object
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{formatLabel(label)}</Text>
        {keys.map((k) => (
          <View key={k} style={styles.kvRow}>
            <Text style={styles.kvLabel}>{formatLabel(k)}</Text>
            <Text style={styles.kvValue}>
              {typeof obj[k] === 'number' ? (obj[k] as number).toFixed(4) : String(obj[k] ?? 'N/A')}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  // Scalar
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{formatLabel(label)}</Text>
      <Text style={styles.metricValue}>
        {typeof value === 'number' ? value.toFixed(4) : String(value)}
      </Text>
    </View>
  );
}

export default function AnalysisDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const stored = await SecureStore.getItemAsync('rdp_tokens');
      if (!stored) return;
      const tokens: TokenResponse = JSON.parse(stored);
      const res = await fetch(`${API_BASE}/analysis/${id}`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (res.ok) setAnalysis(await res.json());
      setLoading(false);
    })();
  }, [id]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (!analysis) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Analysis not found</Text>
      </View>
    );
  }

  const results = analysis.results ?? {};
  const scalarEntries = Object.entries(results).filter(
    ([, v]) => typeof v !== 'object' || v === null,
  );
  const objectEntries = Object.entries(results).filter(
    ([, v]) => typeof v === 'object' && v !== null,
  );

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{formatLabel(analysis.analysis_type)}</Text>
        <View style={[styles.badge, {
          backgroundColor: analysis.status === 'completed' ? '#dcfce7' : analysis.status === 'failed' ? '#fecaca' : '#fef3c7',
        }]}>
          <Text style={{
            color: analysis.status === 'completed' ? '#16a34a' : analysis.status === 'failed' ? '#dc2626' : '#d97706',
            fontSize: 13, fontWeight: '600',
          }}>
            {analysis.status}
          </Text>
        </View>
      </View>
      <Text style={styles.date}>{new Date(analysis.created_at).toLocaleString()}</Text>

      {/* Parameters */}
      {analysis.parameters && Object.keys(analysis.parameters).length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Parameters</Text>
          {Object.entries(analysis.parameters).map(([key, val]) => (
            <View key={key} style={styles.kvRow}>
              <Text style={styles.kvLabel}>{formatLabel(key)}</Text>
              <Text style={styles.kvValue}>
                {Array.isArray(val) ? val.join(', ') : String(val ?? '')}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Error message */}
      {analysis.error_message && (
        <View style={[styles.section, { backgroundColor: '#fef2f2' }]}>
          <Text style={{ color: '#dc2626', fontWeight: '600' }}>Error</Text>
          <Text style={{ color: '#991b1b', marginTop: 4 }}>{analysis.error_message}</Text>
        </View>
      )}

      {/* Scalar metrics */}
      {scalarEntries.length > 0 && (
        <View style={styles.metricsGrid}>
          {scalarEntries.map(([key, val]) => (
            <ResultValue key={key} label={key} value={val} />
          ))}
        </View>
      )}

      {/* Object results */}
      {objectEntries.map(([key, val]) => (
        <ResultValue key={key} label={key} value={val} />
      ))}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb', padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  title: { fontSize: 22, fontWeight: 'bold', flex: 1 },
  date: { fontSize: 13, color: '#9ca3af', marginBottom: 20 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  error: { color: '#dc2626', fontSize: 16 },
  section: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 4, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10, color: '#374151' },
  kvRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  kvLabel: { fontSize: 13, color: '#6b7280', flex: 1 },
  kvValue: { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right' },
  metricsGrid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12,
  },
  metricCard: {
    backgroundColor: '#fff', borderRadius: 10, padding: 12,
    minWidth: '47%', flex: 1, shadowColor: '#000', shadowOpacity: 0.05,
    shadowRadius: 3, elevation: 1,
  },
  metricLabel: { fontSize: 11, color: '#9ca3af', marginBottom: 2 },
  metricValue: { fontSize: 16, fontWeight: '700' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' },
  tableCell: { minWidth: 80, paddingVertical: 6, paddingHorizontal: 8, fontSize: 12 },
  tableHeader: { fontWeight: '700', backgroundColor: '#f9fafb' },
});
