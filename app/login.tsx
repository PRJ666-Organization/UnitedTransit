import { Redirect, useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth, TEST_USER } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function LoginScreen() {
  const { user, login } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = isDark
    ? { bg: '#151718', text: '#ECEDEE', sub: '#9BA1A6', accent: '#fff', inputBg: '#2a2d2e', border: '#3a3d3e' }
    : { bg: '#f5f5f5', text: '#11181C', sub: '#687076', accent: '#0a7ea4', inputBg: '#ffffff', border: '#d5d8dc' };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  if (user) {
    return <Redirect href="/(tabs)" />;
  }

  const handleLogin = () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing fields', 'Please enter email and password.');
      return;
    }

    if (!login(email, password)) {
      Alert.alert('Login failed', 'Invalid email or password.');
      return;
    }
    router.replace('/(tabs)');
  };

  const fillTest = () => {
    setEmail(TEST_USER.email);
    setPassword(TEST_USER.password);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>United Transit</Text>
        <Text style={[styles.subtitle, { color: theme.sub }]}>Sign in to continue</Text>

        <Text style={[styles.label, { color: theme.sub }]}>EMAIL</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
          placeholder="Email"
          placeholderTextColor={theme.sub}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />

        <Text style={[styles.label, { color: theme.sub }]}>PASSWORD</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
          placeholder="Password"
          placeholderTextColor={theme.sub}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity
          style={[styles.loginBtn, { backgroundColor: theme.accent }]}
          onPress={handleLogin}
        >
          <Text style={{ color: theme.bg, fontWeight: '600', fontSize: 16 }}>Sign In</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.testBtn]} onPress={fillTest}>
          <Text style={{ color: theme.sub, fontSize: 14 }}>Use test credentials</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 40,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 14,
    fontSize: 15,
    marginBottom: 16,
  },
  loginBtn: {
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  testBtn: {
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
});
