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
    const storageRef = ref(storage, storagePath);

    // Upload
    await uploadBytes(storageRef, file);

    // Get URL
    const downloadURL = await getDownloadURL(storageRef);

    return {
      file_url: downloadURL,
      storage_path: storagePath
    };
  }
};
