# Location & Route Information Display Troubleshooting

## Changes Made

### 1. **Updated Location Fetching (Both Mobile & Web)**
- Simplified location fetching to match temp branch
- Removed unnecessary console logs that could cause issues
- Mobile: Uses `getCurrentPositionAsync({})` 
- Web: Uses `getCurrentPosition` with basic error handling

### 2. **Fixed Search Result Selection Logic**
- Added waypoint mode check BEFORE checking currentLocation
- This prevents blocking waypoint addition when location isn't available
- Matches temp branch implementation exactly

### 3. **Removed Excessive Console Logs**
- Cleaned up debug logs from:
  - `map-wrapper.tsx`
  - `map-wrapper.web.tsx`
  - `route-information.tsx`
  - `app/(tabs)/index.tsx`

### 4. **Removed Z-Index from RouteInformation**
- Temp branch doesn't use z-index
- RouteInformation uses `position: 'absolute'` with `left: 0`
- Should naturally layer above MapWrapper since it's rendered after

## How It Works

### Location Flow:
1. **On Mount**: App requests location permission and gets current position
2. **Location Stored**: 
   - Mobile: `currentLocation` state in MapWrapper
   - Web: `home` state in MapWrapper.web
3. **User Searches**: Types location in search bar
4. **Selection**: User clicks a search result
5. **Route Creation**:
   - If `currentLocation`/`home` exists → Creates route from current location to destination
   - If not → Shows error "Unable to get your current location"
6. **Display**: RouteInformation receives locations and displays sidebar

### RouteInformation Display Conditions:
```typescript
if (locations.length === 0) {
  return null;  // Don't render
}
// Otherwise, render the sidebar
```

## Common Issues & Solutions

### Issue: "RouteInformation sidebar not showing"

**Possible Causes:**
1. **No Current Location** 
   - Check browser console for: `"Unable to get your current location"`
   - Solution: Enable location services/permissions

2. **Locations Not Being Set**
   - Check state: `displayLocations` should have 2+ locations
   - Check console for errors during route creation

3. **Z-Index/Layering Issue**
   - RouteInformation has `position: absolute, left: 0`
   - Should appear on left side of screen
   - Check browser DevTools to see if element exists in DOM

### Testing Location:

**Mobile (Expo):**
```bash
# You should see in logs:
Location permission: granted
Current location: [lat], [lng]
```

**Web (Browser):**
```bash
# Open DevTools Console
# You should see the location coordinates logged
# OR an error if location access was denied
```

### Manual Test Steps:
1. Open app in browser/expo
2. Grant location permission when prompted
3. Type a destination in search bar
4. Select a location from results
5. **Expected**: RouteInformation sidebar appears on left
6. **Check Console**: Should see transit route API calls

## Next Steps if Still Not Working

1. **Check Browser Console**:
   - Are there JavaScript errors?
   - Is the location permission granted?
   - Are the API calls being made?

2. **Check Network Tab**:
   - Is `/transit-route` endpoint being called?
   - What's the response?

3. **Check React DevTools**:
   - Is `displayLocations` state being set?
   - Is RouteInformation receiving `locations` prop?
   - Are there any React errors?

4. **Manual Location Test**:
   ```typescript
   // Add temporary button to test:
   <Button onPress={() => {
     console.log('Current Location:', currentLocation);
     console.log('Home:', home);
   }} title="Check Location" />
   ```