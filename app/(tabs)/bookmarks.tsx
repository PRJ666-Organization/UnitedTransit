import Bookmark, { BookmarkLocation } from '@/components/bookmark';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type GeoResult = {
  formatted_address: string;
  lat: number;
  lng: number;
};

type BookmarkEntry = {
  id: string;
  name: string;
  locations: BookmarkLocation[];
};

type CreateBookmarkState = {
  name: string;
  locations: BookmarkLocation[];
  searchQuery: string;
};

const initialCreateState: CreateBookmarkState = {
  name: '',
  locations: [],
  searchQuery: '',
};

async function geocodeLocation(query: string): Promise<GeoResult[]> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error('Google Maps API key not configured.');
  }

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`;
  const res = await fetch(url);
  const json = await res.json();

  if (json.status === 'OVER_QUERY_LIMIT' || json.status === 'REQUEST_DENIED') {
    throw new Error(`Geocoding failed: ${json.status}`);
  }

  return (json.results || []).slice(0, 5).map((r: any) => ({
    formatted_address: r.formatted_address,
    lat: r.geometry.location.lat,
    lng: r.geometry.location.lng,
  }));
}

export default function BookmarksScreen() {
  const { user, fetchBookmarks, createBookmark, deleteBookmark, setActiveBookmarkLocations } = useAuth();
  const router = useRouter();
  const theme =
    useColorScheme() === 'dark'
      ? {
          bg: '#111318',
          card: '#1a1d23',
          text: '#ECEDEE',
          sub: '#9BA1A6',
          accent: '#fff',
          inputBg: '#22252b',
          border: '#3a3d3e',
        }
      : {
          bg: '#eceef1',
          card: '#f6f7f8',
          text: '#11181C',
          sub: '#687076',
          accent: '#0a7ea4',
          inputBg: '#ffffff',
          border: '#d5d8dc',
        };

  const [bookmarks, setBookmarks] = useState<BookmarkEntry[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateBookmarkState>(initialCreateState);
  const [geoResults, setGeoResults] = useState<GeoResult[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (user?.token) {
      loadBookmarks();
    }
  }, [user?.token]);

  const loadBookmarks = async () => {
    const data = await fetchBookmarks();
    const parsed: BookmarkEntry[] = data.map((b: any) => ({
      id: String(b.bookmark_id),
      name: b.trip_name,
      locations: b.locations_json ? JSON.parse(b.locations_json) : [],
    }));
    setBookmarks(parsed);
  };

  const searchLocation = (query: string) => {
    setForm((prev) => ({ ...prev, searchQuery: query }));
    setGeoError(null);
    setGeoResults([]);

    if (!query.trim()) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setGeoLoading(true);
      try {
        const results = await geocodeLocation(query);
        setGeoResults(results);
        if (results.length === 0) {
          setGeoError('No locations found.');
        }
      } catch (e) {
        setGeoError((e as Error).message || 'Geocoding failed.');
      } finally {
        setGeoLoading(false);
      }
    }, 500);
  };

  const pickLocation = (result: GeoResult) => {
    setForm((prev) => ({
      ...prev,
      locations: [
        ...prev.locations,
        { latitude: result.lat, longitude: result.lng, name: result.formatted_address },
      ],
      searchQuery: '',
    }));
    setGeoResults([]);
    setGeoError(null);
  };

  const removeLocation = (index: number) => {
    setForm((prev) => ({
      ...prev,
      locations: prev.locations.filter((_, i) => i !== index),
    }));
  };

  const saveBookmark = async () => {
    if (!form.name.trim()) {
      Alert.alert('Name required', 'Bookmark must have a name.');
      return;
    }

    if (form.locations.length === 0) {
      Alert.alert('No locations', 'Add at least one location.');
      return;
    }

    const success = await createBookmark(form.name.trim(), form.locations);
    if (success) {
      await loadBookmarks();
      setForm(initialCreateState);
      setShowForm(false);
    } else {
      Alert.alert('Failed to save', 'Could not create bookmark.');
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    const success = await deleteBookmark(id);
    if (success) {
      setBookmarks((prev) => prev.filter((b) => b.id !== id));
    } else {
      Alert.alert('Failed to delete', 'Could not delete bookmark.');
    }
  };

  const renderBookmark = ({ item }: { item: BookmarkEntry }) => (
    <Bookmark
      name={item.name}
      locations={item.locations}
      onPress={() => {
        setActiveBookmarkLocations(item.locations);
        router.navigate('/');
      }}
      onDelete={() =>
        Alert.alert('Delete bookmark', `Delete "${item.name}"?`, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => handleDeleteBookmark(item.id) },
        ])
      }
    />
  );

  if (showForm) {
    return (
      <ScrollView style={[styles.container, { backgroundColor: theme.bg }]}>
        <ThemedView style={styles.formSection}>
          <ThemedText type="title" style={{ marginBottom: 16 }}>
            New Bookmark
          </ThemedText>

          <ThemedText style={[styles.label, { color: theme.sub }]}>Bookmark Name</ThemedText>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border },
            ]}
            placeholder="e.g. Daily Commute"
            placeholderTextColor={theme.sub}
            value={form.name}
            onChangeText={(text) => setForm((prev) => ({ ...prev, name: text }))}
          />

          <ThemedText style={[styles.label, { color: theme.sub, marginTop: 16 }]}>
            Locations
          </ThemedText>

          {form.locations.map((loc, i) => (
            <View
              key={i}
              style={[styles.locItem, { backgroundColor: theme.card, borderColor: theme.border }]}
            >
              <ThemedText style={{ color: theme.text }}>
                {loc.name ?? `${loc.latitude.toFixed(4)}, ${loc.longitude.toFixed(4)}`}
              </ThemedText>
              <Pressable onPress={() => removeLocation(i)}>
                <Text style={{ color: '#e74c3c', fontWeight: '600', fontSize: 16 }}>✕</Text>
              </Pressable>
            </View>
          ))}

          <View style={styles.searchContainer}>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border },
              ]}
              placeholder="Search location..."
              placeholderTextColor={theme.sub}
              value={form.searchQuery}
              onChangeText={searchLocation}
              autoFocus
            />
            {geoLoading && (
              <View style={styles.loadingRow}>
                <ActivityIndicator size="small" color={theme.accent} />
                <ThemedText style={{ color: theme.sub, fontSize: 13 }}>Searching...</ThemedText>
              </View>
            )}
            {geoError && (
              <ThemedText style={{ color: '#e74c3c', fontSize: 13 }}>{geoError}</ThemedText>
            )}
          </View>

          {geoResults.length > 0 && (
            <ScrollView nestedScrollEnabled style={styles.resultsList}>
              {geoResults.map((result, i) => (
                <Pressable
                  key={i}
                  style={[
                    styles.resultItem,
                    { backgroundColor: theme.card, borderColor: theme.border },
                  ]}
                  onPress={() => pickLocation(result)}
                >
                  <ThemedText style={{ color: theme.text, fontSize: 14 }}>
                    {result.formatted_address}
                  </ThemedText>
                  <ThemedText style={{ color: theme.sub, fontSize: 11 }}>
                    {result.lat.toFixed(4)}, {result.lng.toFixed(4)}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          )}

          <View style={styles.actionRow}>
            <Pressable
              style={[styles.actionBtn, { borderColor: theme.border }]}
              onPress={() => setShowForm(false)}
            >
              <ThemedText style={{ color: theme.sub, fontSize: 15 }}>Cancel</ThemedText>
            </Pressable>
            <Pressable
              style={[
                styles.actionBtn,
                { backgroundColor: theme.accent, borderColor: theme.accent },
              ]}
              onPress={saveBookmark}
            >
              <ThemedText style={{ color: theme.bg, fontWeight: '600', fontSize: 15 }}>
                Save
              </ThemedText>
            </Pressable>
          </View>
        </ThemedView>
      </ScrollView>
    );
  }

  if (!user) {
    return (
      <View style={[styles.container, { backgroundColor: theme.bg }]}>
        <View style={styles.emptyContainer}>
          <ThemedText type="subtitle" style={{ marginBottom: 8 }}>
            Not signed in
          </ThemedText>
          <ThemedText style={{ opacity: 0.6, textAlign: 'center', marginBottom: 16 }}>
            Sign in to save bookmarks.
          </ThemedText>
          <Pressable
            style={[
              styles.actionBtn,
              { backgroundColor: theme.accent, borderColor: theme.accent, height: 100 },
            ]}
            onPress={() => router?.navigate('/login')}
          >
            <ThemedText style={{ color: theme.bg, fontWeight: '600', fontSize: 15 }}>
              Go to Account
            </ThemedText>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={styles.userBar}>
        <ThemedText style={{ color: theme.sub, fontSize: 13 }}>
          Signed in as {user?.email}
        </ThemedText>
      </View>
      {bookmarks.length === 0 ? (
        <View style={styles.emptyContainer}>
          <ThemedText type="subtitle" style={{ marginBottom: 8 }}>
            No bookmarks yet
          </ThemedText>
          <ThemedText style={{ opacity: 0.6, textAlign: 'center' }}>
            Tap + to create a bookmark.
            {'\n'}Long-press a bookmark to delete it.
          </ThemedText>
        </View>
      ) : (
        <FlatList
          data={bookmarks}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderBookmark}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        style={[styles.fab, { backgroundColor: theme.accent }]}
        onPress={() => {
          setForm(initialCreateState);
          setShowForm(true);
        }}
      >
        <Text style={{ color: theme.bg, fontSize: 28, fontWeight: '300', lineHeight: 28 }}>+</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  userBar: {
    padding: 12,
    paddingHorizontal: 20,
  },
  listContent: {
    paddingVertical: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  formSection: {
    padding: 20,
    gap: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  searchContainer: {
    width: '100%',
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  resultsList: {
    maxHeight: 180,
    marginBottom: 4,
  },
  resultItem: {
    padding: 10,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 4,
  },
  locItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    marginVertical: 2,
  },
  addBtn: {
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    borderWidth: 1,
    maxHeight: 50,
  },
});
