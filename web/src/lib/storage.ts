export const storageService = {
  async uploadProjectDocument(
    projectId: string,
    file: File,
    _documentType: string,
    onProgress?: (progress: number) => void,
    classification: string = 'RESTRICTED'
  ): Promise<{ file_url: string; storage_path: string; file_hash?: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('classification', classification);

    const res = await fetch(`/api/projects/${projectId}/documents/upload`, {
      method: 'POST',
      body: formData,
    });

    if (res.status === 409) {
      const body = await res.json();
      const err = new Error(body.message || 'Duplicate file') as Error & { existing_document?: any; status: number };
      err.existing_document = body.existing_document;
      err.status = 409;
      throw err;
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Upload failed');
    }

    onProgress?.(100);
    return res.json();
  },

  async deleteProjectFolder(_projectId: string) {
    // Deletion is handled server-side via CASCADE on project delete.
    return true;
  },
};
