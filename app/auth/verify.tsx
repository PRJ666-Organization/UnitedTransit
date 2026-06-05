import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export default function VerifyScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      return;
    }
    fetch(`${API_URL}/auth/verify?token=${token}`)
      .then((res) => {
        if (res.ok) {
          setStatus('success');
          setTimeout(() => router.replace('/login'), 2000);
        } else {
          setStatus('error');
        }
      })
      .catch(() => setStatus('error'));
  }, [token]);

  return (
    <View style={styles.container}>
      {status === 'verifying' && <Text style={styles.text}>Verifying your email...</Text>}
      {status === 'success' && <Text style={[styles.text, { color: '#27ae60' }]}>Email verified! Redirecting to login...</Text>}
      {status === 'error' && <Text style={[styles.text, { color: '#e74c3c' }]}>Invalid or expired link.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  text: { fontSize: 18, textAlign: 'center' },
});
