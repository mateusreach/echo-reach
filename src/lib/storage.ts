// Upload real de arquivos para o bucket privado "reach-files".
// Como o bucket é privado, geramos uma URL assinada de longa duração e a
// persistimos junto do registro (ideia, conteúdo, marca, configurações).
import { supabase } from "@/integrations/supabase/client";

const BUCKET = "reach-files";
const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export type StoredFile = { name: string; url: string; path?: string };

function safeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .slice(-80);
}

export async function uploadFile(file: File, folder: string): Promise<StoredFile> {
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName(file.name)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;

  const { data, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(path, TEN_YEARS);
  if (signError) throw signError;

  return { name: file.name, url: data.signedUrl, path };
}

export async function uploadFiles(files: FileList | File[], folder: string): Promise<StoredFile[]> {
  const list = Array.from(files);
  const out: StoredFile[] = [];
  for (const f of list) out.push(await uploadFile(f, folder));
  return out;
}

export function isImageUrl(url: string) {
  return /\.(png|jpe?g|gif|webp|avif|svg)(\?|$)/i.test(url) || /image%2F/i.test(url);
}
