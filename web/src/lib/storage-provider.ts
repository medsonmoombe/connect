export interface StorageProvider {
  upload(bucket: string, path: string, data: Buffer, contentType: string): Promise<void>;
  download(bucket: string, path: string): Promise<Buffer>;
  createSignedUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string>;
  remove(bucket: string, paths: string[]): Promise<void>;
}

class SupabaseStorageProvider implements StorageProvider {
  async upload(bucket: string, path: string, data: Buffer, contentType: string): Promise<void> {
    const { getSupabaseAdmin } = await import('./supabase-server');
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from(bucket).upload(path, data, { contentType, upsert: false });
    if (error) throw error;
  }

  async download(bucket: string, path: string): Promise<Buffer> {
    const { getSupabaseAdmin } = await import('./supabase-server');
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(bucket).download(path);
    if (error || !data) throw error ?? new Error('Download returned no data');
    return Buffer.from(await data.arrayBuffer());
  }

  async createSignedUrl(bucket: string, path: string, expiresInSeconds: number): Promise<string> {
    const { getSupabaseAdmin } = await import('./supabase-server');
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
    if (error || !data?.signedUrl) throw error ?? new Error('Failed to create signed URL');
    return data.signedUrl;
  }

  async remove(bucket: string, paths: string[]): Promise<void> {
    const { getSupabaseAdmin } = await import('./supabase-server');
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from(bucket).remove(paths);
    if (error) throw error;
  }
}

let storageProvider: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!storageProvider) {
    storageProvider = new SupabaseStorageProvider();
  }
  return storageProvider;
}

export function setStorageProvider(provider: StorageProvider): void {
  storageProvider = provider;
}
