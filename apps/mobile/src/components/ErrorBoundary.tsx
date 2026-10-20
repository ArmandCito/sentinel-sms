import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { saveCrash } from '@/services/crashLog';

interface State { error: Error | null }

/** Shows render-time errors on screen instead of closing the app. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error): void {
    void saveCrash(error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>SMS Sentinel hit an error</Text>
          <Text style={styles.label}>Send a screenshot of this screen to the developer.</Text>
          <Text selectable style={styles.msg}>{error.message}</Text>
          <Text selectable style={styles.stack}>{(error.stack ?? '').slice(0, 1800)}</Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0B0F17' },
  content: { padding: 24, paddingTop: 64, gap: 12 },
  title: { color: '#EF4444', fontSize: 20, fontWeight: '800' },
  label: { color: '#94A3B8', fontSize: 13 },
  msg: { color: '#E5E7EB', fontSize: 14, fontFamily: 'monospace' },
  stack: { color: '#64748B', fontSize: 11, fontFamily: 'monospace' },
});
