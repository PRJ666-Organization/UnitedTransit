import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

// Note: Alert still used for logout confirmation
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function LoginScreen() {
  const { user, pendingVerifyUrl, login, register, verifyEmail, logout, setTestUser } = useAuth();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const theme = isDark
    ? { bg: '#151718', text: '#FFFFFF', sub: '#A0A4A8', accent: '#fff', inputBg: '#2a2d33', border: '#3d4148' }
    : { bg: '#f0f2f5', text: '#000', sub: '#555555', accent: '#0a7ea4', inputBg: '#ffffff', border: '#d0d0d0' };

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [generalError, setGeneralError] = useState('');

  const clearErrors = () => {
    setEmailError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setGeneralError('');
  };

  const handleSubmit = async () => {
    clearErrors();

    if (!email.trim()) {
      setEmailError('Email is required.');
      return;
    }

    if (!password.trim()) {
      setPasswordError('Password is required.');
      return;
    }

    if (isRegister && password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const success = isRegister
      ? await register(email, password)
      : await login(email, password);
    setLoading(false);

    if (!success) {
      if (isRegister) {
        setEmailError('Could not create account.');
      } else {
        setPasswordError('Incorrect email or password.');
      }
      return;
    }
    if (!isRegister) {
      router.navigate('/(tabs)/bookmarks');
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  const handleTestUser = () => {
    setTestUser();
    router.navigate('/(tabs)/bookmarks');
  };

  if (pendingVerifyUrl) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>Verify your email</Text>
          <Text style={[styles.subtitle, { color: theme.sub }]}>
            A verification link was sent to your email. Click below to verify your account.
          </Text>
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: theme.accent, opacity: loading ? 0.6 : 1 }]}
            disabled={loading}
            onPress={async () => {
              setLoading(true);
              const ok = await verifyEmail();
              setLoading(false);
              if (ok) setIsRegister(false);
            }}
          >
            <Text style={{ color: theme.bg, fontWeight: '600', fontSize: 16 }}>
              {loading ? 'Verifying...' : 'Click to Verify Email'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.text }]}>Signed In</Text>
          <Text style={[styles.subtitle, { color: theme.sub }]}>
            {user.email}
          </Text>
          <TouchableOpacity
            style={[styles.loginBtn, { backgroundColor: '#e74c3c' }]}
            onPress={handleLogout}
          >
            <Text style={{ color: '#fff', fontWeight: '600', fontSize: 16 }}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.content}>
        <Text style={[styles.title, { color: theme.text }]}>United Transit</Text>
        <Text style={[styles.subtitle, { color: theme.sub }]}>
          {isRegister ? 'Create an account' : 'Sign in to continue'}
        </Text>

        <Text style={[styles.label, { color: theme.sub }]}>EMAIL</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
          placeholder="Email"
          placeholderTextColor={theme.sub}
          value={email}
          onChangeText={(val) => { setEmail(val); clearErrors(); }}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}

        <Text style={[styles.label, { color: theme.sub }]}>PASSWORD</Text>
        <TextInput
          style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
          placeholder="Password"
          placeholderTextColor={theme.sub}
          value={password}
          onChangeText={(val) => { setPassword(val); clearErrors(); }}
          secureTextEntry
          editable={!loading}
        />
        {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}

        {isRegister && (
          <>
            <Text style={[styles.label, { color: theme.sub }]}>CONFIRM PASSWORD</Text>
            <TextInput
              style={[styles.input, { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border }]}
              placeholder="Confirm password"
              placeholderTextColor={theme.sub}
              value={confirmPassword}
              onChangeText={(val) => { setConfirmPassword(val); clearErrors(); }}
              secureTextEntry
              editable={!loading}
            />
            {confirmPasswordError ? <Text style={styles.errorText}>{confirmPasswordError}</Text> : null}
          </>
        )}

        <TouchableOpacity
          style={[styles.loginBtn, { backgroundColor: theme.accent, opacity: loading ? 0.6 : 1 }]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={{ color: theme.bg, fontWeight: '600', fontSize: 16 }}>
            {loading ? '...' : isRegister ? 'Create Account' : 'Sign In'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.switchBtn]} onPress={() => setIsRegister((p) => !p)}>
          <Text style={{ color: theme.sub, fontSize: 14 }}>
            {isRegister ? 'Already have an account? Sign in' : "Don't have an account? Register"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.testBtn]} onPress={handleTestUser}>
          <Text style={{ color: '#e74c3c', fontSize: 13, fontWeight: '600' }}>
            [DEV] Bypass auth (test mode)
          </Text>
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
  errorText: {
    color: '#e74c3c',
    fontSize: 12,
    marginBottom: 12,
  },
  switchBtn: {
    padding: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  testBtn: {
    padding: 12,
    alignItems: 'center',
    marginTop: 8,
  },
});
