import { api } from './client';

export interface CloudinaryResponse {
  secure_url: string;
  public_id: string;
  width?: number;
  height?: number;
  format?: string;
}

export const uploadsApi = {
  uploadImagen: async (file: File, folder: string): Promise<CloudinaryResponse> => {
    const form = new FormData();
    form.append('file', file);
    const { data } = await api.post<CloudinaryResponse>(
      `/uploads/imagen?folder=${encodeURIComponent(folder)}`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return data;
  },

  deleteImagen: async (publicId: string): Promise<void> => {
    await api.delete(`/uploads/imagen/${encodeURIComponent(publicId)}`);
  },
};
