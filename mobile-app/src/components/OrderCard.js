import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Image, Platform } from 'react-native';
import { formatRetentionCountdown } from '../utils/geofence';

const DISPLAY_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export default function OrderCard({
  order,
  apiBase,
  onSimulateNear,
  onOpenCamera,
  onSimulatePurge
}) {
  const isDelivered = order.status === 'Delivered';
  const distanceLabel =
    order.currentDistance !== null && order.currentDistance !== undefined
      ? `${order.currentDistance} m`
      : 'Pending GPS';

  return (
    <View style={[styles.card, order.notified100m && !isDelivered ? styles.cardHot : null]}>
      <View style={styles.headerRow}>
        <View style={styles.headerText}>
          <Text style={styles.orderId}>{order.id} / {order.mealPlan}</Text>
          <Text style={styles.customerName}>{order.customerName}</Text>
        </View>
        <View style={[styles.pill, isDelivered ? styles.pillDelivered : styles.pillPending]}>
          <Text style={[styles.pillText, isDelivered ? styles.pillTextDelivered : styles.pillTextPending]}>
            {order.status}
          </Text>
        </View>
      </View>

      <Text style={styles.meta}>Address: {order.address}</Text>
      <Text style={styles.meta}>
        Distance: {distanceLabel} {order.etaMinutes ? `— ETA ${order.etaMinutes} min` : ''}
      </Text>
      {order.notes ? <Text style={styles.notes}>{order.notes}</Text> : null}

      {order.notified100m ? (
        <View style={styles.alertBanner}>
          <Text style={styles.alertText}>100m arrival notice sent automatically</Text>
        </View>
      ) : null}

      {order.proofImage ? (
        <View style={styles.proofBox}>
          <Text style={styles.retentionText}>
            Retention: {formatRetentionCountdown(order.retentionExpiresAt)}
          </Text>
          <Image
            source={{ uri: `${apiBase}${order.proofImage}` }}
            style={styles.preview}
            resizeMode="cover"
          />
          {onSimulatePurge ? (
            <TouchableOpacity style={styles.secondaryBtn} onPress={() => onSimulatePurge(order.id)}>
              <Text style={styles.secondaryBtnText}>Simulate 8-Day Expiry &amp; Purge</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : order.proofPurgedAt ? (
        <View style={styles.purgedBanner}>
          <Text style={styles.purgedText}>
            Photo purged under 7-day retention policy
          </Text>
        </View>
      ) : (
        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => onSimulateNear(order)}>
            <Text style={styles.secondaryBtnText}>Simulate &lt;100m</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => onOpenCamera(order)}>
            <Text style={styles.primaryBtnText}>Take Proof Photo</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FCF9F4',
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#DED4C1',
    shadowColor: '#1E1915',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2
  },
  cardHot: {
    borderColor: '#2F523B',
    borderWidth: 1.5
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8
  },
  headerText: {
    flex: 1,
    paddingRight: 8
  },
  orderId: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9E3B24',
    marginBottom: 2
  },
  customerName: {
    fontFamily: DISPLAY_FONT,
    fontSize: 19,
    fontWeight: '600',
    color: '#1E1915'
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999
  },
  pillPending: {
    backgroundColor: '#F3E8D3'
  },
  pillDelivered: {
    backgroundColor: '#E4EDE6'
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700'
  },
  pillTextPending: {
    color: '#8F6220'
  },
  pillTextDelivered: {
    color: '#2F523B'
  },
  meta: {
    fontSize: 13,
    color: '#5A5046',
    marginBottom: 4
  },
  notes: {
    fontSize: 12,
    fontStyle: 'italic',
    color: '#5A5046',
    backgroundColor: '#ECE4D5',
    padding: 8,
    borderRadius: 6,
    marginVertical: 4
  },
  alertBanner: {
    backgroundColor: '#E4EDE6',
    padding: 8,
    borderRadius: 8,
    marginTop: 6
  },
  alertText: {
    color: '#2F523B',
    fontSize: 12,
    fontWeight: '700'
  },
  proofBox: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#DED4C1',
    paddingTop: 10
  },
  retentionText: {
    fontSize: 12,
    color: '#5A5046',
    fontWeight: '600',
    marginBottom: 8
  },
  preview: {
    width: '100%',
    height: 180,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#DED4C1'
  },
  purgedBanner: {
    marginTop: 10,
    backgroundColor: '#F4E3E3',
    padding: 8,
    borderRadius: 8
  },
  purgedText: {
    color: '#8C2D2D',
    fontSize: 12,
    fontWeight: '600'
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10
  },
  primaryBtn: {
    flex: 1,
    backgroundColor: '#9E3B24',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center'
  },
  primaryBtnText: {
    color: '#FCF9F4',
    fontWeight: '700',
    fontSize: 13
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: '#ECE4D5',
    borderWidth: 1,
    borderColor: '#DED4C1',
    paddingVertical: 11,
    borderRadius: 8,
    alignItems: 'center'
  },
  secondaryBtnText: {
    color: '#1E1915',
    fontWeight: '600',
    fontSize: 13
  }
});
