import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { JobCard } from "@/jobUi";
import { AppScreen, EmptyState, InlineState, PrimaryButton } from "@/mobileUi";
import { colors } from "@/theme";
import { useJobs } from "@/useJobs";

import { api } from "@/api";
import {completeFirmJob,firmOperationError} from "@/firmOperations";

type Filter="all"|"completed"|"cancelled";
export default function History(){
  const {jobs,loading,error,reload}=useJobs();
  const [busy,setBusy]=useState<string|null>(null);
  const [paymentError,setPaymentError]=useState<string|null>(null);
  async function retryPayment(id:string){if(busy)return;setBusy(id);setPaymentError(null);try{await completeFirmJob(id,api);await reload()}catch(error){setPaymentError(firmOperationError(error))}finally{setBusy(null)}}
  const [filter,setFilter]=useState<Filter>("all");
  const history=jobs.filter(job=>["completed","cancelled","no_show"].includes(job.status)).filter(job=>filter==="all"||(filter==="completed"?job.status==="completed":["cancelled","no_show"].includes(job.status)));
  return <AppScreen eyebrow="ISTORIC OPERAȚIONAL" title="Istoric lucrări" subtitle="Rezultatele provin din starea oficială a lucrărilor.">
    <View style={s.filters}><FilterButton active={filter==="all"} title="Toate" onPress={()=>setFilter("all")}/><FilterButton active={filter==="completed"} title="Finalizate" onPress={()=>setFilter("completed")}/><FilterButton active={filter==="cancelled"} title="Anulate" onPress={()=>setFilter("cancelled")}/></View>
    <InlineState loading={loading} error={error} onRetry={()=>void reload()}/>
    {paymentError?<Text accessibilityRole="alert" style={{color:colors.danger,fontSize:14}}>{paymentError}</Text>:null}
    {!loading&&!error&&(history.length?history.map(job=><View key={job.id} style={{gap:8}}><JobCard job={job} firmView/>{job.status==="completed"&&job.financial?.paymentStatus==="authorized"?<><Text style={{fontSize:14,color:colors.muted}}>Lucrare finalizată. Încasarea așteaptă confirmarea.</Text><PrimaryButton disabled={Boolean(busy)} title={busy===job.id?"Se verifică…":"Reîncearcă încasarea"} onPress={()=>void retryPayment(job.id)}/></>:null}</View>):<EmptyState icon="time-outline" title="Istoricul este gol" body="Lucrările finalizate, anulate sau marcate no-show vor apărea aici."/>)}
  </AppScreen>;
}
function FilterButton({active,title,onPress}:{active:boolean;title:string;onPress:()=>void}){return <Pressable accessibilityRole="button" accessibilityState={{selected:active}} onPress={onPress} style={[s.filter,active&&s.filterActive]}><Text style={[s.filterText,active&&s.filterTextActive]}>{title}</Text></Pressable>}
const s=StyleSheet.create({filters:{flexDirection:"row",gap:8},filter:{minHeight:42,paddingHorizontal:14,borderRadius:14,borderWidth:1,borderColor:colors.border,alignItems:"center",justifyContent:"center",backgroundColor:colors.white},filterActive:{backgroundColor:colors.green,borderColor:colors.green},filterText:{fontSize:12,fontWeight:"800",color:colors.muted},filterTextActive:{color:colors.white}});
