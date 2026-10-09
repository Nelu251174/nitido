import {ExecutionChecklist,ExecutionSteps} from "@/ExecutionChecklist";
import {router} from "expo-router";
import { useEffect, useRef, useState, type ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Linking, StyleSheet, Text, View } from "react-native";
import { api } from "@/api";
import { AuthorizedImage } from "@/AuthorizedImage";
import { canCompleteJob, canStartJob, completeFirmJob, firmOperationError, hasProof, markFirmArrived, navigationUrl, paymentState, proofProgress } from "@/firmOperations";
import { jobTypeLabel } from "@/jobTypes";
import { AppScreen, EmptyState, InlineState, Pill, PremiumCard, PrimaryButton, SectionTitle } from "@/mobileUi";
import { uploadFirmProof, type PhotoAsset } from "@/photoUpload";
import { colors } from "@/theme";
import type { Job } from "@/types";
import { useJobs } from "@/useJobs";
import { ActiveTrackingSession, canShareTracking, stopTracking, updateTracking } from "@/tracking";

export default function Active(){
  const {jobs,loading,error:jobsError,reload}=useJobs();
  const [busy,setBusy]=useState<string|null>(null);
  const [error,setError]=useState<string|null>(null);
  const [failed,setFailed]=useState<{jobId:string;asset:PhotoAsset;type:"ARRIVAL"|"COMPLETION"}|null>(null);
  const [confirming,setConfirming]=useState(false);
  const [finished,setFinished]=useState<Job|null>(null);
  const [sharing,setSharing]=useState(false);
  const tracking=useRef(new ActiveTrackingSession());
  const [trackingBusy,setTrackingBusy]=useState(false);
  const job=jobs.find(item=>["accepted","arrived"].includes(item.status));
  // eslint-disable-next-line react-hooks/set-state-in-effect -- a changed server job ends its foreground tracking session
  useEffect(()=>{const current=tracking.current;current.stop();setSharing(false);return()=>{current.stop()}},[job?.id,job?.status]);

  async function chooseProof(type:"ARRIVAL"|"COMPLETION",camera:boolean){if(!job||busy)return;setBusy(`proof-${type}`);setError(null);let asset:PhotoAsset|null=null;try{const picker=await import("expo-image-picker");const permission=camera?await picker.requestCameraPermissionsAsync():{granted:true};if(!permission.granted)throw new Error(camera?"Permite accesul la cameră pentru dovada foto.":"Permite accesul la galerie pentru dovada foto.");const result=camera?await picker.launchCameraAsync({mediaTypes:["images"],quality:.8}):await picker.launchImageLibraryAsync({mediaTypes:["images"],quality:.8});if(result.canceled)return;asset=result.assets[0];await uploadFirmProof(asset,job.id,type);setFailed(null);await reload()}catch(cause){if(asset)setFailed({jobId:job.id,asset,type});setError(firmOperationError(cause))}finally{setBusy(null)}}
  async function retryProof(){if(!job||!failed||failed.jobId!==job.id||busy)return;setBusy(`proof-${failed.type}`);setError(null);try{await uploadFirmProof(failed.asset,job.id,failed.type);setFailed(null);await reload()}catch(cause){setError(firmOperationError(cause))}finally{setBusy(null)}}
  async function start(){if(!job||busy||!canStartJob(job))return;setBusy("arrived");setError(null);try{await markFirmArrived(job.id,api);await reload()}catch(cause){setError(firmOperationError(cause))}finally{setBusy(null)}}
  async function complete(){if(!job||busy||!canCompleteJob(job))return;setBusy("complete");setError(null);try{await completeFirmJob(job.id,api);const detail=await api<{job:Job}>(`/api/jobs/${job.id}`);tracking.current.stop();setSharing(false);setFinished(detail.job);setConfirming(false);await reload()}catch(cause){setError(firmOperationError(cause));setConfirming(false);await reload()}finally{setBusy(null)}}
  async function toggleTracking(){
    if(!job||job.status!=="arrived"||trackingBusy)return;
    setTrackingBusy(true);setError(null);
    try{
      if(sharing){tracking.current.stop();setSharing(false);await stopTracking(job.id,api);return;}
      const Location=await import("expo-location");
      let lastCoordinates:{latitude:number;longitude:number;accuracy:number|null}|null=null;
      const started=await tracking.current.start(job.id,async send=>{
        const permission=await Location.requestForegroundPermissionsAsync();
        if(permission.status!=="granted")throw new Error("Permite locația numai în timpul lucrării pentru a activa urmărirea.");
        return Location.watchPositionAsync({accuracy:Location.Accuracy.Balanced,timeInterval:15_000,distanceInterval:25},position=>{lastCoordinates=position.coords;send()});
      },()=>{if(lastCoordinates)void updateTracking(job.id,lastCoordinates,api).catch(()=>setError("Locația nu a putut fi actualizată. Verifică internetul."))});
      if(started)setSharing(true);
    }catch(cause){setError(cause instanceof Error?cause.message:firmOperationError(cause))}finally{setTrackingBusy(false)}
  }

  if(loading||jobsError)return <AppScreen title="Lucrare activă"><InlineState loading={loading} error={jobsError} onRetry={()=>void reload()}/></AppScreen>;
  if(finished)return <AppScreen eyebrow="FINALIZARE CONFIRMATĂ" title="Lucrarea a fost finalizată"><PremiumCard style={s.success}><Ionicons name="checkmark-circle" size={48} color={colors.green}/><Text style={s.cardTitle}>{jobTypeLabel(finished.space_type)}</Text><Text style={s.detailText}>{paymentState(finished)}</Text><Text style={s.payment}>Confirmarea din platformă nu reprezintă sosirea instantanee a fondurilor în contul bancar.</Text></PremiumCard><PrimaryButton secondary title="Vezi încasările" icon="wallet-outline" onPress={()=>router.push("/(firma)/earnings")}/></AppScreen>;
  if(!job)return <AppScreen eyebrow="EXECUȚIE" title="Lucrare activă"><EmptyState icon="navigate-outline" title="Nu ai o lucrare activă" body="După un Accept confirmat, lucrarea se mută aici automat."/></AppScreen>;
  const arrival=hasProof(job,"ARRIVAL"),completion=hasProof(job,"COMPLETION"),mapUrl=navigationUrl(job);
  const arrivalProgress=proofProgress(job,"ARRIVAL"),completionProgress=proofProgress(job,"COMPLETION");
  const scheduled=job.scheduled_at?new Date(job.scheduled_at).toLocaleString("ro-RO",{day:"numeric",month:"long",year:"numeric",hour:"2-digit",minute:"2-digit"}):"—";
  const started=job.arrived_confirmed_at?new Date(job.arrived_confirmed_at).toLocaleTimeString("ro-RO",{hour:"2-digit",minute:"2-digit"}):null;
  return <AppScreen eyebrow="EXECUȚIE ÎN SIGURANȚĂ" title={jobTypeLabel(job.space_type)} subtitle={`${job.city} · ${job.sqm} m²`}>
    <PremiumCard><View style={s.row}><Text style={s.cardTitle}>Status lucrare</Text><Pill label={job.status==="arrived"?"ÎN DESFĂȘURARE":"ACCEPTATĂ"} tone="green"/></View><Info icon="calendar-outline" text={scheduled}/><Info icon="location-outline" text={job.street?`${job.street}, ${job.city}${job.floor?`, ${job.floor}`:""}`:"Adresa exactă nu a fost furnizată de backend."}/>{job.details?<Info icon="document-text-outline" text={job.details}/>:null}{started?<Info icon="time-outline" text={`Începută la ${started}`}/>:null}{mapUrl?<PrimaryButton secondary icon="navigate-outline" title="Deschide navigația" onPress={()=>void Linking.openURL(mapUrl)}/>:<Text style={s.payment}>Navigația devine disponibilă numai când backendul furnizează adresa autorizată.</Text>}</PremiumCard>
    <ExecutionSteps arrived={job.status==="arrived"} completed={false}/>
    <ExecutionChecklist key={job.id} jobId={job.id} editable jobStatus={job.status} hasArrival={arrival} hasCompletion={completion}/>
    {job.photos?.length?<><SectionTitle title="Fotografii asociate"/><View style={s.photos}>{job.photos.slice(0,5).map(path=><AuthorizedImage key={path} path={path} alt="Fotografie asociată lucrării" style={s.photo}/>)}</View></>:null}
    <PrimaryButton secondary title="Raportează o problemă" icon="warning-outline" onPress={()=>router.push("/(firma)/support")}/>
    <SectionTitle title="Dovezi obligatorii"/>
    <Proof title="Fotografie la sosire" loaded={arrival} count={arrivalProgress.count} required={arrivalProgress.required}/><View style={s.buttonGroup}><PrimaryButton secondary disabled={arrival||busy!==null} loading={busy==="proof-ARRIVAL"} icon="camera-outline" title={arrival?"Fotografie confirmată":"Cameră · sosire"} onPress={()=>void chooseProof("ARRIVAL",true)}/>{!arrival?<PrimaryButton secondary disabled={busy!==null} icon="images-outline" title="Galerie · sosire" onPress={()=>void chooseProof("ARRIVAL",false)}/>:null}</View>
    {failed?.jobId===job.id&&failed.type==="ARRIVAL"?<PrimaryButton secondary loading={busy==="proof-ARRIVAL"} icon="refresh" title="Reîncearcă dovada de sosire" onPress={()=>void retryProof()}/>:null}
    <PrimaryButton disabled={!canStartJob(job)||busy!==null} loading={busy==="arrived"} title="Am ajuns / Începe lucrarea" onPress={()=>void start()}/>
    <Proof title="Fotografie la finalizare" loaded={completion} count={completionProgress.count} required={completionProgress.required}/><View style={s.buttonGroup}><PrimaryButton secondary disabled={completion||job.status!=="arrived"||busy!==null} loading={busy==="proof-COMPLETION"} icon="camera-outline" title={completion?"Fotografie confirmată":"Cameră · finalizare"} onPress={()=>void chooseProof("COMPLETION",true)}/>{!completion?<PrimaryButton secondary disabled={job.status!=="arrived"||busy!==null} icon="images-outline" title="Galerie · finalizare" onPress={()=>void chooseProof("COMPLETION",false)}/>:null}</View>
    {failed?.jobId===job.id&&failed.type==="COMPLETION"?<PrimaryButton secondary loading={busy==="proof-COMPLETION"} icon="refresh" title="Reîncearcă dovada finală" onPress={()=>void retryProof()}/>:null}
    {!confirming?<PrimaryButton disabled={!canCompleteJob(job)||busy!==null} icon="checkmark" title="Finalizează lucrarea" onPress={()=>setConfirming(true)}/>:<PremiumCard><Text style={s.cardTitle}>Confirmi că lucrarea este finalizată?</Text><Text style={s.detailText}>Confirmă după verificarea sarcinilor și a fotografiilor. Finalizarea va fi înregistrată în cont.</Text><PrimaryButton loading={busy==="complete"} disabled={busy!==null} title="Da, finalizează" onPress={()=>void complete()}/><PrimaryButton secondary disabled={busy!==null} title="Înapoi" icon="arrow-back" onPress={()=>setConfirming(false)}/></PremiumCard>}
    <PremiumCard><Text style={s.cardTitle}>Plată și eligibilitate</Text><Text style={s.detailText}>{paymentState(job)}</Text><Text style={s.payment}>Fără dovadă finală și finalizare confirmată de server, plata și payout-ul rămân blocate.</Text></PremiumCard>
    <PremiumCard><Text style={s.cardTitle}>Urmărire pentru Client</Text><Text style={s.detailText}>{job.status==="arrived"?(sharing?"Locația este transmisă pentru această lucrare activă.":"Partajarea este oprită."):"Disponibilă numai după începerea lucrării."}</Text><PrimaryButton secondary loading={trackingBusy} disabled={!canShareTracking(job.status)||trackingBusy} icon={sharing?"location":"location-outline"} title={sharing?"Oprește urmărirea":"Pornește urmărirea"} onPress={()=>void toggleTracking()}/><Text style={s.payment}>Este folosită numai locația foreground, în contextul lucrării active. Serverul oprește expunerea după finalizare.</Text></PremiumCard>
    {error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}
  </AppScreen>;
}
function Info({icon,text}:{icon:ComponentProps<typeof Ionicons>["name"];text:string}){return <View style={s.detail}><Ionicons name={icon} size={20} color={colors.green}/><Text style={s.detailText}>{text}</Text></View>}
function Proof({title,loaded,count,required}:{title:string;loaded:boolean;count:number;required:number}){return <PremiumCard style={s.proof}><View style={[s.proofIcon,loaded&&{backgroundColor:colors.green}]}><Ionicons name={loaded?"checkmark":"camera-outline"} size={21} color={loaded?colors.white:colors.green}/></View><View style={{flex:1}}><Text style={s.proofTitle}>{title} · OBLIGATORIU</Text><Text style={s.proofState}>{count} / {required} fotografii validate de server</Text></View><Pill label={loaded?"Încărcată":"Lipsă"} tone={loaded?"green":"red"}/></PremiumCard>}
const s=StyleSheet.create({row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},cardTitle:{fontSize:17,fontWeight:"800",color:colors.ink},detail:{flexDirection:"row",gap:9,alignItems:"flex-start"},detailText:{flex:1,fontSize:13,lineHeight:20,color:colors.muted},proof:{flexDirection:"row",alignItems:"center"},proofIcon:{width:44,height:44,borderRadius:15,backgroundColor:colors.greenSoft,alignItems:"center",justifyContent:"center"},proofTitle:{fontSize:13,fontWeight:"800",color:colors.ink},proofState:{fontSize:12,color:colors.muted,marginTop:3},buttonGroup:{gap:5},photos:{flexDirection:"row",flexWrap:"wrap",gap:8},photo:{width:82,height:82,borderRadius:14},payment:{fontSize:11,lineHeight:17,color:colors.muted},error:{fontSize:13,lineHeight:19,color:colors.danger,backgroundColor:"#F8E3E1",padding:13,borderRadius:14},success:{alignItems:"center",paddingVertical:28}});
