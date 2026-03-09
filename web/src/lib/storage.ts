import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

export const storageService = {
  /**
   * Upload a project document to Firebase Storage
   */
  async uploadProjectDocument(projectId: string, file: File, documentType: string) {
    if (!storage) throw new Error('Firebase Storage not initialized');

    // Create a path: projects/{projectId}/{timestamp}_{filename}
    const timestamp = Date.now();
    const storagePath = `projects/${projectId}/${timestamp}_${file.name}`;
    console.log(`DEBUG: Storage instance bucket: ${storage.app.options.storageBucket}`);
    const storageRef = ref(storage, storagePath);

    // Upload
    console.log(`Uploading to: ${storagePath}`);
    try {
      await uploadBytes(storageRef, file);
      console.log('uploadBytes successful');
    } catch (error) {
      console.error('Error in uploadBytes:', error);
      throw error;
    }

    // Get URL
    const downloadURL = await getDownloadURL(storageRef);
    console.log(`Download URL obtained: ${downloadURL.substring(0, 50)}...`);

    return {
      file_url: downloadURL,
      storage_path: storagePath
    };
  }
};
