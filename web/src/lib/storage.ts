import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

// TEMPORARY: set to true to route uploads through the server (bypasses CORS).
// Set back to false once Firebase Storage CORS is configured via gsutil.
const USE_SERVER_UPLOAD = true;

export const storageService = {
  async uploadProjectDocument(
    projectId: string,
    file: File,
    documentType: string,
    onProgress?: (progress: number) => void
  ) {
    if (USE_SERVER_UPLOAD) {
      // Server upload uses Supabase cookie auth — no Bearer token needed
      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch(`/api/projects/${projectId}/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Server upload failed');
      }

      onProgress?.(100);
      return res.json() as Promise<{ file_url: string; storage_path: string }>;
    }

    // --- Direct browser upload (original flow) ---
    if (!storage) throw new Error('Firebase Storage not initialized');

    const timestamp = Date.now();
    const storagePath = `projects/${projectId}/${timestamp}_${file.name}`;
    const storageRef = ref(storage, storagePath);
    const uploadTask = uploadBytesResumable(storageRef, file);

    await new Promise<void>((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = snapshot.totalBytes
            ? Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100)
            : 0;
          onProgress?.(progress);
        },
        (error) => reject(error),
        () => resolve()
      );
    });

    const downloadURL = await getDownloadURL(storageRef);
    return { file_url: downloadURL, storage_path: storagePath };
  },

  /**
   * Delete all documents associated with a project
   */
  async deleteProjectFolder(_projectId: string) {
    // Deletion is handled server-side via CASCADE on project delete.
    return true;
  }
};
