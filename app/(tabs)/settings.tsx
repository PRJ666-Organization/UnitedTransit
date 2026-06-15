import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemePreference, useThemeContext } from '@/constants/theme';

export default function SettingsScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { preference, setPreference } = useThemeContext();

  const theme = isDark
    ? { bg: '#151718', text: '#FFFFFF', sub: '#A0A4A8', accent: '#fff', cardBg: '#2a2d33', border: '#3d4148' }
    : { bg: '#f5f5f5', text: '#000', sub: '#555555', accent: '#0a7ea4', cardBg: '#ffffff', border: '#d0d0d0' };

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
        <View style={[styles.settingRow, { flexDirection: 'column', alignItems: 'flex-start' }]}>
          <Text style={[styles.settingLabel, { color: theme.text, marginBottom: 10 }]}>Appearance</Text>
          <View style={styles.themePickerRow}>
            {(['light', 'dark', 'system'] as ThemePreference[]).map((option) => (
              <Pressable
                key={option}
                style={[
                  styles.themeBtn,
                  {
                    backgroundColor: preference === option ? theme.accent : 'transparent',
                    borderColor: preference === option ? theme.accent : theme.border,
                  },
                ]}
                onPress={() => setPreference(option)}
              >
                <Text
                  style={{
                    color: preference === option ? theme.bg : theme.text,
                    fontWeight: '600',
                    fontSize: 13,
                    textTransform: 'capitalize',
                  }}
                >
                  {option}
                </Text>
              </Pressable>
            ))}
          </View>
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
  themePickerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
  },
  themeBtn: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
});
