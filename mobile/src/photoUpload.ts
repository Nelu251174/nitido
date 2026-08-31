import { Platform } from "react-native";
import { api } from "./api";

export type LocalPhoto = { id: string; uri: string; name: string; mimeType: string; status: "uploaded" | "failed" };
export type PhotoAsset = { uri: string; fileName?: string | null; mimeType?: string | null; fileSize?: number | null };

async function photoForm(asset:PhotoAsset):Promise<{form:FormData;name:string;mimeType:string}>{
  if (asset.fileSize && asset.fileSize > 8 * 1024 * 1024) throw new Error("Fotografia depășește limita de 8 MB.");
  const mimeType = asset.mimeType ?? "image/jpeg";
  if (!['image/jpeg','image/png','image/webp','image/gif'].includes(mimeType)) throw new Error("Formatul fotografiei nu este acceptat.");
  const name = asset.fileName ?? `nitido-${Date.now()}.jpg`;
  const form = new FormData();
  if (Platform.OS === "web") {
    const blob = await fetch(asset.uri).then(response => response.blob());
    form.append("file", blob, name);
  } else {
    form.append("file", { uri: asset.uri, name, type: mimeType } as unknown as Blob);
  }
  return {form,name,mimeType};
}

export async function uploadClientPhoto(asset: PhotoAsset): Promise<LocalPhoto> {
  const {form,name,mimeType}=await photoForm(asset);
  const result = await api<{ id: string }>("/api/uploads", { method: "POST", body: form });
  return { id: result.id, uri: asset.uri, name, mimeType, status: "uploaded" };
}

export async function uploadFirmProof(asset:PhotoAsset,jobId:string,proofType:"ARRIVAL"|"COMPLETION"):Promise<LocalPhoto>{
  const {form,name,mimeType}=await photoForm(asset);
  form.append("jobId",jobId);
  form.append("proofType",proofType);
  const result=await api<{id:string}>("/api/uploads",{method:"POST",body:form});
  return {id:result.id,uri:asset.uri,name,mimeType,status:"uploaded"};
}
