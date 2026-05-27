import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = isDark
    ? { bg: '#151718', text: '#ECEDEE', sub: '#9BA1A6', accent: '#fff', cardBg: '#1e2123', border: '#3a3d3e' }
    : { bg: '#f5f5f5', text: '#11181C', sub: '#687076', accent: '#0a7ea4', cardBg: '#ffffff', border: '#e0e0e0' };

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.sub }]}>Account</Text>

        {user ? (
          <View style={styles.settingRow}>
            <View>
              <Text style={[styles.settingLabel, { color: theme.text }]}>{user.email}</Text>
              <Text style={[styles.settingSub, { color: theme.sub }]}>Signed in</Text>
            </View>
            <Pressable onPress={logout} style={{ padding: 8 }}>
              <Text style={{ color: '#e74c3c', fontWeight: '600' }}>Sign Out</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={[styles.settingRow, styles.loginBtn]}
            onPress={() => router.push('/login')}
          >
            <View>
              <Text style={[styles.settingLabel, { color: theme.text }]}>Not signed in</Text>
              <Text style={[styles.settingSub, { color: theme.sub }]}>Sign in to save bookmarks</Text>
            </View>
            <Text style={{ color: theme.accent, fontWeight: '600', fontSize: 15 }}>Sign In →</Text>
          </Pressable>
        )}
      </View>

      <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.sub }]}>Preferences</Text>
        <View style={styles.settingRow}>
          <Text style={[styles.settingLabel, { color: theme.text }]}>Appearance</Text>
          <Text style={[styles.settingSub, { color: theme.sub }]}>{isDark ? 'Dark' : 'Light'}</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  section: {
    margin: 16,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    padding: 12,
    paddingBottom: 4,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    paddingTop: 8,
  },
  loginBtn: {
    marginTop: -4,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingSub: {
    fontSize: 13,
    marginTop: 2,
  },
});
