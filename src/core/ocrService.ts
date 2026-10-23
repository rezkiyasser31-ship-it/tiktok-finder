/**
 * Step 6: On-device ML Kit Text Recognition (OCR) for TikTok thumbnails and shared screenshots.
 *
 * Uses @react-native-ml-kit/text-recognition:
 * - Runs fully on-device (zero API quota, zero cost, works offline).
 * - Copies content:// URIs to local cache before recognition to avoid Android permission denial.
 * - Returns structured text blocks with bounding boxes and line coordinates.
 */

import * as FileSystem from 'expo-file-system/legacy';
import { OcrRecognitionResult } from '../types';

// Safely require native text recognition module to support test/web environments
let TextRecognition: any = null;
try {
  TextRecognition = require('@react-native-ml-kit/text-recognition').default;
} catch {
  TextRecognition = null;
}

/**
 * Ensures an image URI is an accessible local file:// URI.
 * On Android, expo-share-intent often provides content:// URIs from other apps.
 * Copying to the app's cache directory prevents SecurityException: Permission Denial.
 */
export async function ensureLocalImageUri(
  imageUri: string
): Promise<{ localPath: string; cleanup?: () => Promise<void> }> {
  if (!imageUri) {
    throw new Error('No image URI provided for text recognition');
  }

  // Already a local file URI
  if (imageUri.startsWith('file://')) {
    return { localPath: imageUri };
  }

  // Handle content:// URIs
  if (imageUri.startsWith('content://')) {
    const tempFileName = `ocr_share_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.jpg`;
    const cacheDir = FileSystem.cacheDirectory || '';
    const destUri = `${cacheDir}${tempFileName}`;

    try {
      await FileSystem.copyAsync({
        from: imageUri,
        to: destUri,
      });

      return {
        localPath: destUri,
        cleanup: async () => {
          try {
            await FileSystem.deleteAsync(destUri, { idempotent: true });
          } catch {}
        },
      };
    } catch (copyErr: any) {
      console.warn('[OCR] Content URI copyAsync failed, trying fetch fallback:', copyErr.message || copyErr);
      try {
        const response = await fetch(imageUri);
        const blob = await response.blob();
        const reader = new FileReader();
        const base64Data = await new Promise<string>((resolve, reject) => {
          reader.onloadend = () => {
            const res = reader.result as string;
            const base64 = res.includes(',') ? res.split(',')[1] : res;
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        await FileSystem.writeAsStringAsync(destUri, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });

        return {
          localPath: destUri,
          cleanup: async () => {
            try {
              await FileSystem.deleteAsync(destUri, { idempotent: true });
            } catch {}
          },
        };
      } catch (fetchErr: any) {
        console.warn('[OCR] Fetch fallback also failed, falling back to direct URI:', fetchErr.message || fetchErr);
        return { localPath: imageUri };
      }
    }
  }

  // Bare path without scheme
  if (!imageUri.startsWith('http')) {
    return { localPath: `file://${imageUri}` };
  }

  return { localPath: imageUri };
}

/**
 * Recognizes text and bounding blocks from a local image file URI using on-device ML Kit.
 */
export async function recognizeImageText(imageUri: string): Promise<OcrRecognitionResult> {
  if (!imageUri) {
    return { text: '', blocks: [] };
  }

  if (!TextRecognition || typeof TextRecognition.recognize !== 'function') {
    console.warn('[OCR] ML Kit TextRecognition native module not available in this environment');
    return { text: '', blocks: [] };
  }

  const { localPath, cleanup } = await ensureLocalImageUri(imageUri);

  try {
    const result = await TextRecognition.recognize(localPath);
    if (!result) {
      return { text: '', blocks: [] };
    }

    const rawText = (result.text || '').trim();
    const blocks = Array.isArray(result.blocks) ? result.blocks : [];

    return {
      text: rawText,
      blocks,
    };
  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error('[OCR] Recognition error on path ' + localPath + ':', errorMsg);
    throw new Error(`OCR processing failed: ${errorMsg}`);
  } finally {
    if (cleanup) {
      await cleanup();
    }
  }
}

/**
 * Downloads a remote TikTok thumbnail URL to cache and runs OCR on it.
 */
export async function recognizeThumbnailText(thumbnailUrl: string): Promise<OcrRecognitionResult> {
  if (!thumbnailUrl || !thumbnailUrl.startsWith('http')) {
    return { text: '', blocks: [] };
  }

  if (!TextRecognition || typeof TextRecognition.recognize !== 'function') {
    return { text: '', blocks: [] };
  }

  const tempPath = `${FileSystem.cacheDirectory || ''}thumb_${Date.now()}.jpg`;
  try {
    const downloadRes = await FileSystem.downloadAsync(thumbnailUrl, tempPath);
    if (!downloadRes || !downloadRes.uri) {
      return { text: '', blocks: [] };
    }

    const ocrResult = await recognizeImageText(downloadRes.uri);

    // Clean up temporary image
    try {
      await FileSystem.deleteAsync(downloadRes.uri, { idempotent: true });
    } catch {}

    return ocrResult;
  } catch (error: any) {
    console.warn('[OCR] Thumbnail recognition failed:', error?.message || error);
    try {
      await FileSystem.deleteAsync(tempPath, { idempotent: true });
    } catch {}
    return { text: '', blocks: [] };
  }
}
