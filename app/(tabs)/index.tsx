import { ScrollView, StyleSheet, Text, View } from 'react-native';
import MapWrapper from '../../components/map-wrapper';

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>Map View</Text>
      </View>

      <MapWrapper />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    height: 120,
    backgroundColor: '#007AFF',
    justifyContent: 'flex-end',
    paddingBottom: 10,
  },
  headerText: {
    padding: 25,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
  },
});