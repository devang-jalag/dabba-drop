import React, { useState, useEffect, useCallback } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
  Platform
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { useCameraPermissions } from 'expo-camera';

import {
  DEFAULT_API_BASE,
  fetchDeliveries,
  postDriverLocation,
  postOrderLocation,
  uploadOrderProof,
  simulateOrderRetentionPurge,
  resetDemo
} from './src/config/api';
import OrderCard from './src/components/OrderCard';
import CameraModal from './src/components/CameraModal';

const DISPLAY_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export default function App() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [apiInput, setApiInput] = useState(DEFAULT_API_BASE);
  const [activeTab, setActiveTab] = useState('driver');
  const [deliveries, setDeliveries] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({});
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('TIFFIN-101');
  const [cameraOrder, setCameraOrder] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();

  const loadState = useCallback(async () => {
    try {
      const data = await fetchDeliveries(apiBase);
      setDeliveries(data.deliveries || []);
      setNotifications(data.notifications || []);
      setStats(data.stats || {});
    } catch (err) {
      Alert.alert(
        'Server Connection',
        `Could not reach ${apiBase}. Make sure server.js is running and update the LAN IP in Settings.\n\nDetails: ${err.message}`
      );
    }
  }, [apiBase]);

  useEffect(() => {
    loadState();
  }, [loadState]);

  useEffect(() => {
    let subscription = null;
    if (!gpsActive) return undefined;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Denied', 'Location access is needed for 100m arrival notices.');
        setGpsActive(false);
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          distanceInterval: 10,
          timeInterval: 5000
        },
        async (loc) => {
          const { latitude, longitude } = loc.coords;
          setGpsCoords({ lat: latitude, lng: longitude });
          try {
            const res = await postDriverLocation(apiBase, latitude, longitude);
            setDeliveries(res.deliveries || []);
            setNotifications(res.notifications || []);
            setStats(res.stats || {});
            if (res.triggeredAlerts && res.triggeredAlerts.length > 0) {
              const first = res.triggeredAlerts[0];
              Alert.alert(
                '100m Notice Sent',
                `${first.customerName} (${first.id}) was notified at ${first.distance}m.`
              );
            }
          } catch (err) {
            console.log('GPS sync error:', err.message);
          }
        }
      );
    })();

    return () => {
      if (subscription) subscription.remove();
    };
  }, [gpsActive, apiBase]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadState();
    setRefreshing(false);
  };

  const handleSimulateNear = async (order) => {
    try {
      const res = await postOrderLocation(
        apiBase,
        order.id,
        order.lat + 0.00035,
        order.lng + 0.00015
      );
      await loadState();
      Alert.alert(
        'Geofence Checked',
        `${res.orderId} is ${res.distanceMeters}m away.\n100m Alert Sent: ${res.proximityAlertSent ? 'Yes' : 'No'}`
      );
    } catch (err) {
      Alert.alert('Simulation Failed', err.message);
    }
  };

  const handleOpenCamera = async (order) => {
    if (!cameraPermission?.granted) {
      const perm = await requestCameraPermission();
      if (!perm.granted) {
        Alert.alert('Camera Required', 'Enable camera permission to take a doorstep photo.');
        return;
      }
    }
    setCameraOrder(order);
  };

  const handleUploadProof = async (orderId, photoUri) => {
    setUploading(true);
    try {
      await uploadOrderProof(apiBase, orderId, photoUri);
      setCameraOrder(null);
      await loadState();
      Alert.alert('Delivered', `Photo saved for ${orderId}. Retained for 7 days.`);
    } catch (err) {
      Alert.alert('Upload Failed', err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSimulatePurge = async (orderId) => {
    try {
      await simulateOrderRetentionPurge(apiBase, orderId);
      await loadState();
      Alert.alert('Retention Verified', `Simulated 8-day expiry and purged photo for ${orderId}.`);
    } catch (err) {
      Alert.alert('Retention Error', err.message);
    }
  };

  const handleReset = async () => {
    try {
      const data = await resetDemo(apiBase);
      setDeliveries(data.deliveries || []);
      setNotifications(data.notifications || []);
      setStats(data.stats || {});
      Alert.alert('Route Reset', 'All orders and logs reset cleanly.');
    } catch (err) {
      Alert.alert('Reset Error', err.message);
    }
  };

  const trackedOrder = deliveries.find((d) => d.id === selectedOrderId) || deliveries[0];
  const trackedNotifs = trackedOrder
    ? notifications.filter((n) => n.tiffinId === trackedOrder.id)
    : [];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.brand}>Dabba Drop ({Platform.OS.toUpperCase()})</Text>
        <Text style={styles.subBrand}>
          {gpsCoords
            ? `GPS: ${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}`
            : 'Recurring Route Dispatch & Doorstep Ledger'}
        </Text>

        <View style={styles.tabRow}>
          {[
            { key: 'driver', label: 'Route Dispatch' },
            { key: 'customer', label: 'Order Lookup' },
            { key: 'settings', label: 'Ledger & API' }
          ].map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tabBtn, activeTab === tab.key ? styles.tabBtnActive : null]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key ? styles.tabTextActive : null]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView
        style={styles.body}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {activeTab === 'driver' && (
          <View>
            <View style={styles.driverToolbar}>
              <TouchableOpacity
                style={[styles.toolbarBtn, gpsActive ? styles.btnSuccess : styles.btnDark]}
                onPress={() => setGpsActive((prev) => !prev)}
              >
                <Text style={styles.toolbarBtnText}>
                  {gpsActive ? 'Live GPS Active' : 'Start Live GPS'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.toolbarBtn, styles.btnOutline]} onPress={handleReset}>
                <Text style={styles.outlineBtnText}>Reset Route</Text>
              </TouchableOpacity>
            </View>

            {deliveries.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                apiBase={apiBase}
                onSimulateNear={handleSimulateNear}
                onOpenCamera={handleOpenCamera}
                onSimulatePurge={handleSimulatePurge}
              />
            ))}
          </View>
        )}

        {activeTab === 'customer' && (
          <View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
              {deliveries.map((d) => (
                <TouchableOpacity
                  key={d.id}
                  style={[styles.orderChip, selectedOrderId === d.id ? styles.orderChipActive : null]}
                  onPress={() => setSelectedOrderId(d.id)}
                >
                  <Text style={selectedOrderId === d.id ? styles.orderChipTextActive : styles.orderChipText}>
                    {d.id}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {trackedOrder ? (
              <OrderCard
                order={trackedOrder}
                apiBase={apiBase}
                onSimulateNear={handleSimulateNear}
                onOpenCamera={handleOpenCamera}
                onSimulatePurge={handleSimulatePurge}
              />
            ) : null}

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Automated Notices ({trackedNotifs.length})</Text>
              {trackedNotifs.length === 0 ? (
                <Text style={styles.muted}>No automated notices yet for this order.</Text>
              ) : (
                trackedNotifs.map((n) => (
                  <View key={n.id} style={styles.notifItem}>
                    <Text style={styles.notifTitle}>{n.title}</Text>
                    <Text style={styles.notifBody}>{n.message}</Text>
                  </View>
                ))
              )}
            </View>
          </View>
        )}

        {activeTab === 'settings' && (
          <View>
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>Dispatch Server URL</Text>
              <Text style={styles.muted}>
                Use http://localhost:3000 (iOS Simulator), http://10.0.2.2:3000 (Android Emulator), or your computer LAN IP on physical phones.
              </Text>
              <TextInput
                style={styles.input}
                value={apiInput}
                onChangeText={setApiInput}
                autoCapitalize="none"
                autoCorrect={false}
                placeholder="http://192.168.1.50:3000"
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => setApiBase(apiInput.replace(/\/+$/, ''))}
              >
                <Text style={styles.toolbarBtnText}>Save &amp; Reconnect</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.panel}>
              <Text style={styles.panelTitle}>7-Day Retention Summary</Text>
              <Text style={styles.metricLine}>Total Orders: {stats.totalOrders ?? 0}</Text>
              <Text style={styles.metricLine}>100m Notices Sent: {stats.notified100mCount ?? 0}</Text>
              <Text style={styles.metricLine}>Active Doorstep Photos: {stats.activeProofCount ?? 0}</Text>
              <Text style={styles.metricLine}>Purged Photos (&gt;7 days): {stats.purgedProofCount ?? 0}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <CameraModal
        visible={Boolean(cameraOrder)}
        order={cameraOrder}
        uploading={uploading}
        onClose={() => setCameraOrder(null)}
        onSubmitPhoto={handleUploadProof}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#F5F0E6'
  },
  header: {
    backgroundColor: '#1E1915',
    paddingTop: Platform.OS === 'android' ? 38 : 12,
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#352D27'
  },
  brand: {
    fontFamily: DISPLAY_FONT,
    color: '#FAF6EE',
    fontSize: 21,
    fontWeight: '600'
  },
  subBrand: {
    fontFamily: DISPLAY_FONT,
    fontStyle: 'italic',
    color: '#C9BDAC',
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12
  },
  tabRow: {
    flexDirection: 'row',
    gap: 8
  },
  tabBtn: {
    flex: 1,
    backgroundColor: 'rgba(245, 240, 230, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(222, 212, 193, 0.22)',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center'
  },
  tabBtnActive: {
    backgroundColor: '#F5F0E6',
    borderColor: '#F5F0E6'
  },
  tabText: {
    color: '#D7CCB9',
    fontWeight: '600',
    fontSize: 12
  },
  tabTextActive: {
    color: '#1E1915',
    fontWeight: '700'
  },
  body: {
    flex: 1,
    padding: 14
  },
  driverToolbar: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12
  },
  toolbarBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center'
  },
  btnDark: {
    backgroundColor: '#9E3B24'
  },
  btnSuccess: {
    backgroundColor: '#2F523B'
  },
  btnOutline: {
    backgroundColor: '#FCF9F4',
    borderWidth: 1,
    borderColor: '#DED4C1'
  },
  toolbarBtnText: {
    color: '#FCF9F4',
    fontWeight: '700',
    fontSize: 13
  },
  outlineBtnText: {
    color: '#1E1915',
    fontWeight: '600',
    fontSize: 13
  },
  chipScroll: {
    marginBottom: 12
  },
  orderChip: {
    backgroundColor: '#FCF9F4',
    borderWidth: 1,
    borderColor: '#DED4C1',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginRight: 8
  },
  orderChipActive: {
    backgroundColor: '#9E3B24',
    borderColor: '#9E3B24'
  },
  orderChipText: {
    color: '#1E1915',
    fontWeight: '600',
    fontSize: 12
  },
  orderChipTextActive: {
    color: '#FCF9F4',
    fontWeight: '700',
    fontSize: 12
  },
  panel: {
    backgroundColor: '#FCF9F4',
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DED4C1'
  },
  panelTitle: {
    fontFamily: DISPLAY_FONT,
    fontSize: 17,
    fontWeight: '600',
    color: '#1E1915',
    marginBottom: 6
  },
  muted: {
    fontSize: 12,
    color: '#877B6E',
    marginBottom: 8
  },
  notifItem: {
    backgroundColor: '#F5F0E6',
    borderLeftWidth: 3,
    borderLeftColor: '#9E3B24',
    padding: 10,
    borderRadius: 8,
    marginTop: 6
  },
  notifTitle: {
    fontWeight: '700',
    fontSize: 13,
    color: '#1E1915'
  },
  notifBody: {
    fontSize: 12,
    color: '#5A5046',
    marginTop: 2
  },
  input: {
    borderWidth: 1,
    borderColor: '#DED4C1',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    backgroundColor: '#FFFFFF',
    color: '#1E1915',
    marginBottom: 10
  },
  saveBtn: {
    backgroundColor: '#9E3B24',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center'
  },
  metricLine: {
    fontSize: 13,
    color: '#5A5046',
    marginTop: 4
  }
});
