# Complete Route Information Display Flow

## How It Works

### 1. **App Loads & Gets Location**
```typescript
// MapWrapper.tsx
useEffect(() => {
  setLocationLoading(true);
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status === 'granted') {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
      maximumAge: 10000,
      timeout: 20000,
    });
    setCurrentLocation({
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
    });
    setLocationLoading(false);
  }
}, []);
```

**Console Log:**
```
[MapWrapper] handleSelectResult - currentLocation: {latitude: 43.65, longitude: -79.38} locationLoading: false
```

### 2. **User Searches for Destination**
- User types in search box
- Search results dropdown appears
- User clicks a result

### 3. **Destination Selection Handler**
```typescript
// MapWrapper.tsx - handleSelectResult
const handleSelectResult = (result) => {
  // Check if location is loading
  if (locationLoading) {
    setSearchError('Getting your location... Please try again in a moment.');
    return;
  }

  // Check if we have location
  if (!currentLocation) {
    setSearchError('Unable to get your location. Please enable location services.');
    return;
  }

  // Create origin and destination
  const origin = {
    latitude: currentLocation.latitude,
    longitude: currentLocation.longitude,
    name: 'Current Location',
  };

  const destination = {
    latitude: result.lat,
    longitude: result.lng,
    name: result.formatted_address,
  };

  // Call callback
  onDestinationSelected(origin, destination);
};
```

**Console Logs:**
```
[MapWrapper] handleSelectResult - currentLocation: {...} locationLoading: false
[MapWrapper] Calling onDestinationSelected with origin: {...} destination: {...}
```

### 4. **HomeScreen Handler**
```typescript
// index.tsx - handleDestinationSelected
const handleDestinationSelected = async (origin, destination) => {
  const locations = [origin, destination];
  setDisplayLocations(locations);  // ← THIS TRIGGERS ROUTE INFORMATION DISPLAY
  setTripName('Route to Destination');
  setSelectedRouteIndex(0);
  setIsAddingWaypoint(false);

  // Save to search history
  await saveSearchHistory(locations);
};
```

**Console Logs:**
```
[HomeScreen] handleDestinationSelected - origin: {...} destination: {...}
[HomeScreen] displayLocations: 2 [{...}, {...}]
```

### 5. **RouteInformation Renders**
```typescript
// RouteInformation receives locations prop
<RouteInformation
  locations={displayLocations}  // ← Passed from HomeScreen
  ...
/>

// RouteInformation.tsx
if (locations.length === 0) {
  return null;  // Don't render if no locations
}

// Otherwise, render the sidebar panel
return (
  <ScrollView style={[styles.container, { backgroundColor: colors.bg }]}>
    {/* Route information UI */}
  </ScrollView>
);
```

**Console Log:**
```
[RouteInformation] Props - locations: 2 [{latitude: 43.65, ...}, {latitude: 45.42, ...}]
```

### 6. **Fetch Transit Routes**
```typescript
// RouteInformation.tsx - useEffect
useEffect(() => {
  if (locations.length >= 2) {
    fetchDirections();  // ← Fetch routes from server
  }
}, [locations]);
```

**Backend Log:**
```
[Transit Route] mode=... pref=... summary="" ...
[Transit Route] Combined X unique route(s)
```

## Common Issues & Solutions

### ❌ Issue: "Getting your location..." Error
**Cause:** Location still loading
**Solution:** Wait for location to finish loading (usually 2-5 seconds)

### ❌ Issue: "Unable to get your current location" Error
**Cause:** Location permission denied or GPS unavailable
**Solutions:**
- Grant location permission when prompted
- Enable location services in device settings
- Move near a window (better GPS reception)
- Check browser console for specific error

### ❌ Issue: RouteInformation sidebar not showing
**Cause:** `displayLocations` not being set properly
**Check:**
1. Console logs show locations being set: `[HomeScreen] displayLocations: 2 [...]`
2. RouteInformation receives prop: `[RouteInformation] Props - locations: 2 [...]`
3. Check React DevTools for `displayLocations` state

### ❌ Issue: Sidebar shows but no routes
**Cause:** Transit API not returning data
**Check:**
1. Backend server is running
2. API URL is correct
3. Backend logs show route calculations
4. Network tab shows `/transit-route` API call

## Debug Checklist

Open browser/expo console and check for these logs:

✅ **App loads:**
```
(no location logs unless error)
```

✅ **Search for destination:**
```
[MapWrapper] handleSelectResult - currentLocation: {...} locationLoading: false
[MapWrapper] Calling onDestinationSelected with origin: {...} destination: {...}
[HomeScreen] handleDestinationSelected - origin: {...} destination: {...}
[HomeScreen] displayLocations: 2 [...]
[RouteInformation] Props - locations: 2 [...]
```

✅ **RouteInformation fetches routes:**
```
[RouteInformation] Calling fetchDirections
[Transit Route] ... (backend logs)
```

## Testing the Flow

### Manual Test Steps:

1. **Start app** - Wait 5 seconds for location
2. **Search for destination** - Type "Toronto Union Station"
3. **Select result** - Click on search result
4. **Verify console logs** - Should see the chain of logs above
5. **Check UI** - Sidebar should appear on left with route info

### If Sidebar Doesn't Appear:

1. **Check console for errors**
2. **Verify location is set:**
   ```typescript
   console.log('Current location:', currentLocation);
   ```
3. **Verify displayLocations state:**
   ```typescript
   console.log('Display locations:', displayLocations);
   ```
4. **Check RouteInformation props:**
   ```typescript
   console.log('RouteInformation locations:', locations);
   ```

## Success Indicators

When everything works correctly, you should see:

✅ Location permission prompt (first time only)
✅ Current location marker on map
✅ Search results dropdown when typing
✅ Sidebar appears on left after selecting destination
✅ Route details with transit options
✅ Map shows route polylines

The route information sidebar appears as a panel on the left side of the screen with:
- Origin and destination stops
- Transit route options
- Departure/arrival times
- Walking segments