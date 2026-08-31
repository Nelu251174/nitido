import { useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { Image, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api } from "@/api";
import { DateSelector } from "@/DateSelector";
import { JOB_TYPE_LABELS, jobTypeLabel } from "@/jobTypes";
import { AppScreen, PremiumCard, PrimaryButton, Pill } from "@/mobileUi";
import { canAddPhoto, EMPTY_DRAFT, isDateAllowed, isSlotAllowed, MAX_DETAILS_LENGTH, MAX_PHOTOS, nextPostStep, postJobError, previousPostStep, quoteMatchesDraft, validateSqm, type JobQuote, type PostJobDraft, type SchedulingConfig } from "@/postJobCore";
import { uploadClientPhoto, type LocalPhoto } from "@/photoUpload";
import { publishClientJob, requestAuthoritativeQuote } from "@/postJobService";
import { colors } from "@/theme";
import type { SpaceType } from "@/types";

const STEPS = ["Tip serviciu", "Detalii spațiu", "Adresă", "Data", "Ora", "Detalii suplimentare", "Fotografii", "Estimare preț", "Verificare comandă", "Confirmare și publicare"];

export default function PostJob() {
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<PostJobDraft>(EMPTY_DRAFT);
  const [quote, setQuote] = useState<JobQuote | null>(null);
  const [scheduling, setScheduling] = useState<SchedulingConfig | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [photos, setPhotos] = useState<LocalPhoto[]>([]);
  const [photoLoading, setPhotoLoading] = useState(false);
  const [failedPhoto, setFailedPhoto] = useState<{ uri: string; fileName?: string | null; mimeType?: string | null; fileSize?: number | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const requestId = useRef<string | null>(null);

  function update<K extends keyof PostJobDraft>(key: K, value: PostJobDraft[K]) {
    setDraft(old => ({ ...old, [key]: value }));
    if (key === "spaceType" || key === "sqm") { setQuote(null); setScheduling(null); }
    setError(null);
  }

  async function requestQuote() {
    if (!draft.spaceType || validateSqm(draft.sqm)) return false;
    setQuoteLoading(true); setError(null);
    try {
      const result = await requestAuthoritativeQuote(draft, api);
      setQuote(result.quote);
      setScheduling(result.scheduling);
      return true;
    } catch (cause) { setError(postJobError(cause)); return false; }
    finally { setQuoteLoading(false); }
  }

  function validationForCurrentStep() {
    if (step === 0 && !draft.spaceType) return "Alege tipul serviciului.";
    if (step === 1) return validateSqm(draft.sqm);
    if (step === 2 && (!draft.city.trim() || !draft.street.trim())) return "Completează orașul și strada cu număr.";
    if (step === 3 && !isDateAllowed(draft.scheduledDate)) return "Alege o dată de astăzi sau din viitor.";
    if (step === 4 && !isSlotAllowed(draft.scheduledDate, draft.scheduledHour, new Date(), scheduling?.slotHours, scheduling?.minLeadHours)) return "Alege un interval disponibil conform programării NITIDO.";
    if (step === 5 && draft.details.length > MAX_DETAILS_LENGTH) return `Detaliile pot avea maximum ${MAX_DETAILS_LENGTH} de caractere.`;
    if (step >= 7 && !quoteMatchesDraft(quote, draft)) return "Estimarea trebuie reconfirmată de platformă.";
    return null;
  }

  async function next() {
    const validation = validationForCurrentStep();
    if (validation) { setError(validation); return; }
    if (step === 1 && !(await requestQuote())) return;
    setStep(nextPostStep);
  }

  async function selectPhoto(camera: boolean) {
    if (!canAddPhoto(photos.length)) { setError(`Poți atașa maximum ${MAX_PHOTOS} fotografii.`); return; }
    setPhotoLoading(true); setError(null);
    let selected: { uri: string; fileName?: string | null; mimeType?: string | null; fileSize?: number | null } | null = null;
    try {
      const picker = await import("expo-image-picker");
      const permission = camera ? await picker.requestCameraPermissionsAsync() : await picker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) throw new Error(camera ? "Permite accesul la cameră pentru a face fotografia." : "Permite accesul la fotografii pentru a alege imaginea.");
      const result = camera ? await picker.launchCameraAsync({ mediaTypes: ["images"], quality: 0.8 }) : await picker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled) return;
      selected = result.assets[0];
      const uploaded = await uploadClientPhoto(selected);
      setPhotos(old => [...old, uploaded]);
      setDraft(old => ({ ...old, photoIds: [...old.photoIds, uploaded.id] }));
      setFailedPhoto(null);
    } catch (cause) { if (selected) setFailedPhoto(selected); setError(cause instanceof Error ? cause.message : "Fotografia nu a putut fi încărcată."); }
    finally { setPhotoLoading(false); }
  }

  async function retryPhoto() {
    if (!failedPhoto || photoLoading) return;
    setPhotoLoading(true); setError(null);
    try {
      const uploaded = await uploadClientPhoto(failedPhoto);
      setPhotos(old => [...old, uploaded]);
      setDraft(old => ({ ...old, photoIds: [...old.photoIds, uploaded.id] }));
      setFailedPhoto(null);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Fotografia nu a putut fi încărcată."); }
    finally { setPhotoLoading(false); }
  }

  function removePhoto(id: string) {
    setPhotos(old => old.filter(photo => photo.id !== id));
    setDraft(old => ({ ...old, photoIds: old.photoIds.filter(photoId => photoId !== id) }));
  }

  async function publish() {
    if (submitting || createdId) return;
    if (!quoteMatchesDraft(quote, draft)) { setError("Estimarea nu mai corespunde datelor. Revino la pasul de preț."); return; }
    setSubmitting(true); setError(null);
    requestId.current ??= `mobile-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      const result = await publishClientJob(draft, requestId.current, api);
      setCreatedId(result.job.id);
    } catch (cause) { setError(postJobError(cause)); }
    finally { setSubmitting(false); }
  }

  const dateText = draft.scheduledDate ? new Date(`${draft.scheduledDate}T12:00:00`).toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" }) : "—";
  return <AppScreen eyebrow={`PASUL ${step + 1} DIN ${STEPS.length}`} title="Postează o lucrare" subtitle={STEPS[step]}>
    <View accessibilityLabel={`Pasul ${step + 1} din ${STEPS.length}`} style={styles.progress}><View style={[styles.fill, { width: `${((step + 1) / STEPS.length) * 100}%` }]}/></View>
    {step === 0 ? <ServiceStep value={draft.spaceType} onChange={value => update("spaceType", value)}/> : null}
    {step === 1 ? <PremiumCard><Field label="Suprafața spațiului" value={draft.sqm} onChange={value => update("sqm", value.replace(/\D/g, ""))} keyboard="number-pad" suffix="m²"/><Text style={styles.note}>Backendul acceptă o suprafață întreagă pozitivă. Prețul este solicitat separat de la NITIDO.</Text></PremiumCard> : null}
    {step === 2 ? <PremiumCard><Field label="Oraș" value={draft.city} onChange={value => update("city", value)} placeholder="București"/><Field label="Stradă și număr" value={draft.street} onChange={value => update("street", value)} placeholder="Strada Exemplu 10"/><Field label="Cod poștal (opțional)" value={draft.postalCode} onChange={value => update("postalCode", value)} keyboard="number-pad"/><Field label="Etaj / acces (opțional)" value={draft.floor} onChange={value => update("floor", value)}/><Text style={styles.privacy}><Ionicons name="lock-closed"/> Adresa exactă rămâne protejată înainte de alocarea firmei.</Text></PremiumCard> : null}
    {step === 3 ? <PremiumCard><Text style={styles.label}>Data lucrării</Text><DateSelector value={draft.scheduledDate} onChange={value => update("scheduledDate", value)}/><Text style={styles.note}>Data este transmisă fără conversii UTC care ar putea schimba ziua aleasă.</Text></PremiumCard> : null}
    {step === 4 ? <PremiumCard><Text style={styles.label}>Ora de începere</Text><View style={styles.slots}>{(scheduling?.slotHours ?? []).map(hour => <Pressable accessibilityRole="radio" accessibilityState={{ checked: draft.scheduledHour === hour }} key={hour} onPress={() => update("scheduledHour", hour)} style={[styles.slot, draft.scheduledHour === hour && styles.selected]}><Text style={[styles.slotText, draft.scheduledHour === hour && styles.selectedText]}>{String(hour).padStart(2, "0")}:00</Text></Pressable>)}</View><Text style={styles.note}>Intervalele și avansul minim de {scheduling?.minLeadHours ?? "—"} oră/ore sunt furnizate de backend.</Text></PremiumCard> : null}
    {step === 5 ? <PremiumCard><Text style={styles.label}>Observații pentru firmă (opțional)</Text><TextInput accessibilityLabel="Detalii suplimentare" multiline maxLength={MAX_DETAILS_LENGTH} value={draft.details} onChangeText={value => update("details", value)} placeholder="Acces, parcare, animale de companie sau cerințe speciale" style={styles.textarea}/><Text style={styles.counter}>{draft.details.length}/{MAX_DETAILS_LENGTH}</Text></PremiumCard> : null}
    {step === 6 ? <PremiumCard><Text style={styles.label}>Fotografii ale spațiului (opțional)</Text><Text style={styles.note}>Maximum 5 imagini JPEG, PNG, WebP sau GIF, de cel mult 8 MB fiecare.</Text><View style={styles.photoActions}><PrimaryButton secondary loading={photoLoading} icon="camera-outline" title="Cameră" onPress={() => void selectPhoto(true)}/><PrimaryButton secondary loading={photoLoading} icon="images-outline" title="Galerie" onPress={() => void selectPhoto(false)}/>{failedPhoto?<PrimaryButton secondary loading={photoLoading} icon="refresh" title="Reîncearcă încărcarea" onPress={() => void retryPhoto()}/>:null}</View><View style={styles.photos}>{photos.map(photo => <View key={photo.id} style={styles.photo}><Image alt="Fotografie atașată lucrării" source={{ uri: photo.uri }} style={styles.photoImage}/><Pressable accessibilityLabel="Elimină fotografia" onPress={() => removePhoto(photo.id)} style={styles.remove}><Ionicons name="close" color={colors.white} size={17}/></Pressable></View>)}</View><Text style={styles.note}>{photos.length} din {MAX_PHOTOS} fotografii încărcate și validate de server.</Text></PremiumCard> : null}
    {step === 7 ? <PremiumCard style={styles.priceCard}>{quoteLoading ? <Text style={styles.note}>NITIDO calculează estimarea…</Text> : quote ? <><Pill tone="green" label="PREȚ ESTIMAT"/><Text style={styles.price}>{quote.priceGross} lei</Text><Text style={styles.duration}>Durată estimată: {quote.durationMinutes} minute</Text><Text style={styles.note}>Prețul este calculat pe baza datelor introduse și confirmat de platformă.</Text><PrimaryButton secondary title="Recalculează" icon="refresh" onPress={() => void requestQuote()}/></> : <PrimaryButton title="Solicită estimarea" onPress={() => void requestQuote()}/>}</PremiumCard> : null}
    {step === 8 || step === 9 ? <Review draft={draft} dateText={dateText} quote={quote}/> : null}
    {step === 9 && !createdId ? <PremiumCard><Text style={styles.confirmTitle}>Datele sunt corecte?</Text><Text style={styles.note}>La publicare, serverul validează din nou programarea, prețul, fotografiile și identitatea contului Client.</Text><PrimaryButton loading={submitting} disabled={submitting} title="Confirmă și publică" icon="checkmark-circle" onPress={() => void publish()}/></PremiumCard> : null}
    {createdId ? <PremiumCard style={styles.success}><Ionicons name="checkmark-circle" size={46} color={colors.green}/><Text style={styles.confirmTitle}>Lucrarea a fost publicată.</Text><Text style={styles.note}>Status actual: Așteptăm o firmă.</Text><PrimaryButton title="Vezi lucrarea" onPress={() => router.replace({ pathname: "/(client)/job/[id]", params: { id: createdId } })}/><PrimaryButton secondary title="Lucrările mele" onPress={() => router.replace("/(client)/jobs")}/></PremiumCard> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {!createdId && step < 9 ? <View style={styles.actions}>{step > 0 ? <PrimaryButton secondary title="Înapoi" icon="arrow-back" onPress={() => { setError(null); setStep(previousPostStep); }}/> : null}<PrimaryButton loading={quoteLoading && step === 7} title={step === 8 ? "Continuă spre confirmare" : "Continuă"} onPress={() => void next()}/></View> : null}
    {!createdId && step === 9 ? <PrimaryButton secondary title="Modifică" icon="create-outline" onPress={() => setStep(0)}/> : null}
  </AppScreen>;
}

function ServiceStep({ value, onChange }: { value: SpaceType | null; onChange: (value: SpaceType) => void }) { return <View style={styles.grid}>{Object.entries(JOB_TYPE_LABELS).map(([key, label]) => <Pressable accessibilityRole="radio" accessibilityState={{ checked: value === key }} key={key} onPress={() => onChange(key as SpaceType)} style={[styles.service, value === key && styles.selected]}><View style={styles.serviceIcon}><Ionicons name={key === "birou" ? "business-outline" : "home-outline"} size={23} color={colors.green}/></View><Text style={styles.serviceTitle}>{label}</Text><Text style={styles.serviceBody}>Categorie acceptată de backendul NITIDO.</Text></Pressable>)}</View>; }
function Field({ label, value, onChange, placeholder, keyboard = "default", suffix }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; keyboard?: "default" | "number-pad"; suffix?: string }) { return <View><Text style={styles.label}>{label}</Text><View style={styles.fieldRow}><TextInput accessibilityLabel={label} keyboardType={keyboard} value={value} onChangeText={onChange} placeholder={placeholder} style={styles.field}/>{suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}</View></View>; }
function Review({ draft, dateText, quote }: { draft: PostJobDraft; dateText: string; quote: JobQuote | null }) { const rows = [["Tip lucrare", draft.spaceType ? jobTypeLabel(draft.spaceType) : "—"], ["Suprafață", `${draft.sqm} m²`], ["Adresă", `${draft.street}, ${draft.city}`], ["Dată", dateText], ["Oră", draft.scheduledHour === null ? "—" : `${String(draft.scheduledHour).padStart(2, "0")}:00`], ["Detalii", draft.details || "Fără observații"], ["Fotografii", String(draft.photoIds.length)], ["Preț total", quote ? `${quote.priceGross} lei` : "—"]]; return <PremiumCard>{rows.map(([label, value]) => <View key={label} style={styles.reviewRow}><Text style={styles.reviewLabel}>{label}</Text><Text style={styles.reviewValue}>{value}</Text></View>)}</PremiumCard>; }

const styles = StyleSheet.create({progress:{height:6,borderRadius:99,backgroundColor:"#D9DED9",overflow:"hidden"},fill:{height:"100%",backgroundColor:colors.green,borderRadius:99},grid:{flexDirection:"row",flexWrap:"wrap",gap:10},service:{width:"48%",minHeight:150,borderRadius:20,borderWidth:1,borderColor:colors.border,backgroundColor:colors.white,padding:17,gap:9},selected:{borderColor:colors.green,backgroundColor:colors.greenSoft},selectedText:{color:colors.greenDark},serviceIcon:{width:42,height:42,borderRadius:14,backgroundColor:colors.greenSoft,alignItems:"center",justifyContent:"center"},serviceTitle:{fontSize:16,fontWeight:"800",color:colors.ink},serviceBody:{fontSize:11,lineHeight:16,color:colors.muted},label:{fontSize:13,fontWeight:"800",color:colors.ink,marginBottom:7},fieldRow:{flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:colors.border,borderRadius:16,backgroundColor:colors.white,paddingHorizontal:15},field:{flex:1,minHeight:56,fontSize:16,color:colors.ink},suffix:{fontSize:17,fontWeight:"800",color:colors.muted},note:{fontSize:12,lineHeight:18,color:colors.muted},privacy:{fontSize:12,lineHeight:18,color:colors.greenDark,backgroundColor:colors.greenSoft,padding:12,borderRadius:13},slots:{flexDirection:"row",flexWrap:"wrap",gap:9},slot:{minWidth:"30%",minHeight:50,borderWidth:1,borderColor:colors.border,borderRadius:15,alignItems:"center",justifyContent:"center"},slotText:{fontSize:15,fontWeight:"800",color:colors.ink},textarea:{minHeight:130,borderWidth:1,borderColor:colors.border,borderRadius:16,padding:14,textAlignVertical:"top",fontSize:15,lineHeight:21,color:colors.ink},counter:{fontSize:11,color:colors.muted,textAlign:"right"},photoActions:{gap:5},photos:{flexDirection:"row",flexWrap:"wrap",gap:9},photo:{width:82,height:82},photoImage:{width:82,height:82,borderRadius:14},remove:{position:"absolute",right:-5,top:-5,width:28,height:28,borderRadius:14,backgroundColor:colors.ink,alignItems:"center",justifyContent:"center"},priceCard:{alignItems:"center",paddingVertical:28},price:{fontSize:43,fontWeight:"800",letterSpacing:-1.5,color:colors.ink},duration:{fontSize:14,fontWeight:"700",color:colors.greenDark},reviewRow:{flexDirection:"row",gap:16,justifyContent:"space-between",paddingVertical:9,borderBottomWidth:1,borderBottomColor:colors.border},reviewLabel:{fontSize:12,color:colors.muted},reviewValue:{flex:1,fontSize:13,fontWeight:"700",color:colors.ink,textAlign:"right"},confirmTitle:{fontSize:20,fontWeight:"800",color:colors.ink},success:{alignItems:"center",paddingVertical:28},error:{fontSize:13,lineHeight:19,color:colors.danger,backgroundColor:"#F8E3E1",padding:13,borderRadius:14},actions:{gap:5,marginTop:8}});
