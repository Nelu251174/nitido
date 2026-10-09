import { useState } from "react";
import { router } from "expo-router";
import { Text } from "react-native";
import { api } from "@/api";
import { acceptFirmJob, firmOperationError } from "@/firmOperations";
import { useJobs } from "@/useJobs";
import { JobCard } from "@/jobUi";
import { AppScreen, EmptyState, InlineState, PremiumCard } from "@/mobileUi";
import { colors } from "@/theme";

export default function FirmJobs(){
  const {jobs,loading,error,reload}=useJobs();
  const [accepting,setAccepting]=useState<string|null>(null);
  const [notice,setNotice]=useState<{ok:boolean;text:string}|null>(null);
  async function accept(id:string){
    if(accepting)return;
    setAccepting(id);setNotice(null);
    try{await acceptFirmJob(id,api);setNotice({ok:true,text:"Lucrarea a fost preluată."});await reload();router.replace("/(firma)/active");}
    catch(cause){setNotice({ok:false,text:firmOperationError(cause)});await reload();}
    finally{setAccepting(null)}
  }
  const available=jobs.filter(job=>job.status==="waiting");
  return <AppScreen eyebrow="FEED ELIGIBIL" title="Lucrări disponibile" subtitle="Doar informațiile permise înainte de alocare.">
    {notice?<PremiumCard style={{backgroundColor:notice.ok?colors.greenSoft:"#F8E3E1"}}><Text accessibilityRole="alert" style={{color:notice.ok?colors.greenDark:colors.danger,fontWeight:"700"}}>{notice.text}</Text></PremiumCard>:null}
    <InlineState loading={loading} error={error} onRetry={()=>void reload()}/>
    {!loading&&!error&&(available.length?available.map(job=><JobCard key={job.id} job={job} firmView accepting={accepting===job.id} onPress={()=>router.push({pathname:"/(firma)/job-preview/[id]",params:{id:job.id}})} onAccept={()=>void accept(job.id)}/>):<EmptyState icon="search-outline" title="Nu sunt lucrări disponibile momentan" body="Feedul se actualizează cu lucrările eligibile din zonele deservite."/>)}
  </AppScreen>;
}
