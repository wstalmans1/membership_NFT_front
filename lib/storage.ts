import { supabase, STORAGE_BUCKET } from './supabase';

/**
 * Upload a photo to Supabase Storage
 * @param file - The photo file to upload
 * @param fileName - The name for the file (e.g., "token-1.jpg" or "user-address.jpg")
 * @returns Public URL of the uploaded photo
 */
export async function uploadPhoto(file: File, fileName: string): Promise<string> {
  try {
    // Upload file to Supabase Storage
    const { data, error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false, // Don't overwrite existing files
      });

    if (error) {
      throw new Error(`Failed to upload photo: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for uploaded photo');
    }

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading photo:', error);
    throw error;
  }
}

/**
 * Delete a photo from Supabase Storage
 * @param fileName - The name of the file to delete
 */
export async function deletePhoto(fileName: string): Promise<void> {
  try {
    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([fileName]);

    if (error) {
      throw new Error(`Failed to delete photo: ${error.message}`);
    }
  } catch (error) {
    console.error('Error deleting photo:', error);
    throw error;
  }
}

/**
 * Get public URL for a photo (without uploading)
 * @param fileName - The name of the file
 * @returns Public URL
 */
export function getPhotoUrl(fileName: string): string {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(fileName);

  return data.publicUrl;
}

