import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { ThemePreference, useThemeContext } from '@/constants/theme';
import { useRouter } from 'expo-router';
import React, { useState, useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, TextInput, Alert } from 'react-native';

export default function SettingsScreen() {
  const { user, logout, getHomeAddress, setHomeAddress, deleteHomeAddress } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { preference, setPreference } = useThemeContext();

  const [homeAddress, setHomeAddressState] = useState<string>('');
  const [homeLat, setHomeLat] = useState<number | null>(null);
  const [homeLng, setHomeLng] = useState<number | null>(null);
  const [isEditing, setIsEditing] = useState<boolean>(false);

  const theme = isDark
    ? {
        bg: '#151718',
        text: '#FFFFFF',
        sub: '#A0A4A8',
        accent: '#fff',
        cardBg: '#2a2d33',
        border: '#3d4148',
        danger: '#e74c3c',
      }
    : {
        bg: '#f5f5f5',
        text: '#000',
        sub: '#555555',
        accent: '#0a7ea4',
        cardBg: '#ffffff',
        border: '#d0d0d0',
        danger: '#e74c3c',
      };

  useEffect(() => {
    if (user) {
      loadHomeAddress();
    }
  }, [user]);

  const loadHomeAddress = async () => {
    const home = await getHomeAddress();
    if (home.homeAddress) {
      setHomeAddressState(home.homeAddress);
      setHomeLat(home.homeLat || null);
      setHomeLng(home.homeLng || null);
      setIsEditing(false);
    }
  };

  const handleSaveHome = async () => {
    if (!homeAddress.trim()) {
      Alert.alert('Error', 'Please enter an address');
      return;
    }

    try {
      // Use Google Maps Geocoding API to validate and get coordinates
      const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(homeAddress)}&key=${apiKey}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results && data.results.length > 0) {
        const result = data.results[0];
        const lat = result.geometry.location.lat;
        const lng = result.geometry.location.lng;
        const formattedAddress = result.formatted_address;

        const success = await setHomeAddress(formattedAddress, lat, lng);
        if (success) {
          setHomeAddressState(formattedAddress);
          setHomeLat(lat);
          setHomeLng(lng);
          setIsEditing(false);
          Alert.alert('Success', 'Home address saved');
        } else {
          Alert.alert('Error', 'Failed to save home address');
        }
      } else {
        Alert.alert('Error', 'Address not found. Please enter a valid address.');
      }
    } catch (e) {
      console.error('[Settings] Geocoding error:', e);
      Alert.alert('Error', 'Failed to geocode address. Please try again.');
    }
  };

  const handleDeleteHome = async () => {
    Alert.alert(
      'Delete Home Address',
      'Are you sure you want to remove your home address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteHomeAddress();
            if (success) {
              setHomeAddressState('');
              setHomeLat(null);
              setHomeLng(null);
              setIsEditing(false);
              Alert.alert('Success', 'Home address removed');
            } else {
              Alert.alert('Error', 'Failed to remove home address');
            }
          }
        }
      ]
    );
  };

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
              <Text style={[styles.settingSub, { color: theme.sub }]}>
                Sign in to save bookmarks
              </Text>
            </View>
            <Text style={{ color: theme.accent, fontWeight: '600', fontSize: 15 }}>Sign In →</Text>
          </Pressable>
        )}
      </View>

      {user && (
        <View style={[styles.section, { backgroundColor: theme.cardBg, borderColor: theme.border }]}>
          <Text style={[styles.sectionTitle, { color: theme.sub }]}>Home Address</Text>
          <View style={styles.settingRow}>
            <View style={{ flex: 1 }}>
              {homeLat && homeLng && !isEditing ? (
                <>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Home Location</Text>
                  <Text style={[styles.settingSub, { color: theme.sub, marginTop: 4 }]}>
                    {homeAddress}
                  </Text>
                  <View style={styles.buttonRow}>
                    <Pressable
                      style={[styles.button, { backgroundColor: theme.accent }]}
                      onPress={() => setIsEditing(true)}
                    >
                      <Text style={[styles.buttonText, { color: isDark ? '#000' : '#fff' }]}>Edit</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.button, { backgroundColor: theme.danger }]}
                      onPress={handleDeleteHome}
                    >
                      <Text style={[styles.buttonText, { color: '#fff' }]}>Remove</Text>
                    </Pressable>
                  </View>
                </>
              ) : (
                <>
                  <Text style={[styles.settingLabel, { color: theme.text }]}>Set Home Location</Text>
                  <Text style={[styles.settingSub, { color: theme.sub, marginTop: 4 }]}>
                    {homeLat && homeLng
                      ? 'Edit your home address'
                      : 'Set your home address for quick access'}
                  </Text>
                  <TextInput
                    style={[styles.input, { borderColor: theme.border, color: theme.text }]}
                    value={homeAddress}
                    onChangeText={setHomeAddressState}
                    placeholder="Enter your home address"
                    placeholderTextColor={theme.sub}
                  />
                  <View style={styles.buttonRow}>
                    <Pressable
                      style={[styles.button, { backgroundColor: theme.accent }]}
                      onPress={handleSaveHome}
                    >
                      <Text style={[styles.buttonText, { color: isDark ? '#000' : '#fff' }]}>Save</Text>
                    </Pressable>
                    {homeLat && homeLng && (
                      <Pressable
                        style={[styles.button, { backgroundColor: theme.border }]}
                        onPress={() => {
                          setIsEditing(false);
                          loadHomeAddress();
                        }}
                      >
                        <Text style={[styles.buttonText, { color: theme.text }]}>Cancel</Text>
                      </Pressable>
                    )}
                  </View>
                </>
              )}
            </View>
          </View>
        </View>
      )}

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
  input: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  buttonText: {
    fontWeight: '600',
    fontSize: 14,
  },
});
