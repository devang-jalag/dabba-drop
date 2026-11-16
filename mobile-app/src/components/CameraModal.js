import React, { useState, useRef } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform
} from 'react-native';
import { CameraView } from 'expo-camera';

const DISPLAY_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

export default function CameraModal({
  visible,
  order,
  uploading,
  onClose,
  onSubmitPhoto
}) {
  const cameraRef = useRef(null);
  const [facing, setFacing] = useState('back');
  const [capturedUri, setCapturedUri] = useState(null);

  const handleClose = () => {
    setCapturedUri(null);
    onClose();
  };

  const takePicture = async () => {
    if (!cameraRef.current) return;
    const photo = await cameraRef.current.takePictureAsync({ quality: 0.75 });
    setCapturedUri(photo.uri);
  };

  const confirmUpload = async () => {
    if (!capturedUri || !order) return;
    await onSubmitPhoto(order.id, capturedUri);
    setCapturedUri(null);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        <View style={styles.topBar}>
          <View>
            <Text style={styles.title}>
              Doorstep Proof — {order ? order.id : ''}
            </Text>
            <Text style={styles.subtitle}>
              {order ? `${order.customerName} — 7-day retention` : ''}
            </Text>
          </View>
          <TouchableOpacity style={styles.closeBtn} onPress={handleClose}>
            <Text style={styles.closeBtnText}>Close</Text>
          </TouchableOpacity>
        </View>

        {capturedUri ? (
          <View style={styles.previewWrap}>
            <Image source={{ uri: capturedUri }} style={styles.previewImage} resizeMode="cover" />
            <View style={styles.controlsRow}>
              <TouchableOpacity
                style={styles.retakeBtn}
                onPress={() => setCapturedUri(null)}
                disabled={uploading}
              >
                <Text style={styles.btnText}>Retake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.uploadBtn}
                onPress={confirmUpload}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator color="#FCF9F4" />
                ) : (
                  <Text style={styles.btnText}>Upload Proof</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <CameraView style={styles.camera} ref={cameraRef} facing={facing}>
            <View style={styles.cameraOverlay}>
              <TouchableOpacity
                style={styles.flipBtn}
                onPress={() => setFacing((prev) => (prev === 'back' ? 'front' : 'back'))}
              >
                <Text style={styles.btnText}>Flip</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.shutterBtn} onPress={takePicture}>
                <View style={styles.shutterInner} />
              </TouchableOpacity>

              <View style={styles.spacer} />
            </View>
          </CameraView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1915'
  },
  topBar: {
    paddingTop: 52,
    paddingBottom: 14,
    paddingHorizontal: 18,
    backgroundColor: '#2A231E',
    borderBottomWidth: 1,
    borderBottomColor: '#3E342C',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontFamily: DISPLAY_FONT,
    color: '#FAF6EE',
    fontSize: 17,
    fontWeight: '600'
  },
  subtitle: {
    color: '#C9BDAC',
    fontSize: 12,
    marginTop: 2
  },
  closeBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#3E342C',
    borderRadius: 8
  },
  closeBtnText: {
    color: '#FAF6EE',
    fontWeight: '600'
  },
  camera: {
    flex: 1,
    justifyContent: 'flex-end'
  },
  cameraOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingVertical: 32,
    backgroundColor: 'rgba(30, 25, 21, 0.58)'
  },
  flipBtn: {
    backgroundColor: 'rgba(245, 240, 230, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20
  },
  shutterBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    borderWidth: 3.5,
    borderColor: '#F5F0E6',
    justifyContent: 'center',
    alignItems: 'center'
  },
  shutterInner: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#9E3B24'
  },
  spacer: {
    width: 60
  },
  previewWrap: {
    flex: 1,
    padding: 16,
    justifyContent: 'space-between'
  },
  previewImage: {
    flex: 1,
    borderRadius: 12,
    marginBottom: 16
  },
  controlsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingBottom: 18
  },
  retakeBtn: {
    flex: 1,
    backgroundColor: '#3E342C',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  uploadBtn: {
    flex: 1.5,
    backgroundColor: '#2F523B',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center'
  },
  btnText: {
    color: '#FCF9F4',
    fontWeight: '700',
    fontSize: 15
  }
});
