import { ref, uploadBytesResumable, getDownloadURL, listAll, deleteObject } from 'firebase/storage';
import { storage } from './firebase';

export const storageService = {
  /**
   * Upload a project document to Firebase Storage with progress tracking
   */
  async uploadProjectDocument(
    projectId: string,
    file: File,
    documentType: string,
    onProgress?: (progress: number) => void
  ) {
    if (!storage) throw new Error('Firebase Storage not initialized');

    const timestamp = Date.now();
    const storagePath = `projects/${projectId}/${timestamp}_${file.name}`;
    console.log(`DEBUG: Storage instance bucket: ${storage.app.options.storageBucket}`);
    const storageRef = ref(storage, storagePath);

    console.log(`Uploading to: ${storagePath}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    try {
      await new Promise<void>((resolve, reject) => {
        const unsubscribe = uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = snapshot.totalBytes
              ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
              : 0;
            onProgress?.(progress);
          },
          (error) => {
            console.error('Error in uploadBytesResumable:', error);
            reject(error);
          },
          async () => {
            console.log('uploadBytesResumable successful');
            resolve();
          }
        );
      });

      const downloadURL = await getDownloadURL(storageRef);
      console.log(`Download URL obtained: ${downloadURL.substring(0, 50)}...`);

      return {
        file_url: downloadURL,
        storage_path: storagePath
      };
    } catch (error) {
      console.error('Error in uploadBytesResumable:', error);
      throw error;
    }
  },

  /**
   * Delete all documents associated with a project
   */
  async deleteProjectFolder(projectId: string) {
    if (!storage) throw new Error('Firebase Storage not initialized');

    const folderPath = `projects/${projectId}`;
    const folderRef = ref(storage, folderPath);

    try {
      const result = await listAll(folderRef);
      
      const deletePromises = result.items.map(fileRef => deleteObject(fileRef));
      await Promise.all(deletePromises);
      
      console.log(`Successfully deleted all files in ${folderPath}`);
      return true;
    } catch (error) {
      console.error(`Error deleting folder ${folderPath}:`, error);
      throw error;
    }
  }
};
