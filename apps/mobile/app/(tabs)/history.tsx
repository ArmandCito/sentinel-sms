import React, { useCallback, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { Verdict } from '@sentinel/contracts';
import { Button } from '@/components/Button';
import { GlassCard } from '@/components/GlassCard';
import { MessageRow } from '@/components/MessageRow';
import { Screen } from '@/components/Screen';
import { useSentinel } from '@/state/SentinelContext';
import { colors, verdictColor, verdictLabel } from '@/theme';
import { native } from '@/services/native';

type Filter = 'all' | Verdict;
const FILTERS: Filter[] = ['all', 'danger', 'caution', 'safe'];

export default function History() {
  const router = useRouter();
  const { records, permissions, importInbox, requestPermissions, refreshPermissions } = useSentinel();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const shown = useMemo(() => (filter === 'all' ? records : records.filter((r) => r.verdict === filter)), [records, filter]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshPermissions();
    setRefreshing(false);
  }, [refreshPermissions]);

  const onImport = async () => {
    if (!permissions.readSms) { await requestPermissions(); return; }
    const n = await importInbox(30);
    Alert.alert('Inbox scanned', n > 0 ? `${n} recent messages analysed on-device.` : 'No messages found.');
  };

  return (
    <Screen refreshing={refreshing} onRefresh={onRefresh}>
      <Text style={styles.title}>History</Text>
      <View style={styles.chips}>
        {FILTERS.map((f) => {
          const active = f === filter;
          const c = f === 'all' ? colors.accent : verdictColor[f];
          return (
            <Pressable key={f} onPress={() => setFilter(f)} style={[styles.chip, active && { backgroundColor: `${c}26`, borderColor: `${c}99` }]}>
              <Text style={[styles.chipText, active && { color: c }]}>{f === 'all' ? 'All' : verdictLabel[f]}</Text>
            </Pressable>
          );
        })}
      </View>

      {native.available && <Button label="Scan my recent inbox (on-device)" variant="ghost" onPress={onImport} />}

      {shown.length === 0 ? (
        <GlassCard><Text style={styles.empty}>No messages here yet.</Text></GlassCard>
      ) : (
        shown.map((r) => <MessageRow key={r.id} record={r} onPress={() => router.push({ pathname: '/message/[id]', params: { id: r.id } })} />)
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 26, fontWeight: '800' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: 'rgba(255,255,255,0.03)' },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  empty: { color: colors.textDim, fontSize: 14 },
});
