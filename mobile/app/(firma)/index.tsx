import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "@/auth";
import { JobCard } from "@/jobUi";
import { AppScreen, EmptyState, InlineState, Metric, Pill, PremiumCard, PrimaryButton, SectionTitle } from "@/mobileUi";
import { colors } from "@/theme";
import { useJobs } from "@/useJobs";

export default function FirmHome(){
  const {user}=useAuth();
  const {jobs,loading,error,reload}=useJobs();
  const available=jobs.filter(job=>job.status==="waiting");
  const active=jobs.filter(job=>["accepted","arrived"].includes(job.status));
  const completed=jobs.filter(job=>job.status==="completed");
  const verified=Boolean(user?.firm?.verified);
  return <AppScreen eyebrow="CONT FIRMĂ" title={`Bun venit, ${user?.name??"echipă"}.`} subtitle="Vezi rapid ce necesită atenția ta.">
    <PremiumCard style={s.verify}><View style={s.flex}><Text style={s.verifyTitle}>Status verificare</Text><Text style={s.verifyBody}>{verified?"Firma poate primi lucrările eligibile din zonele sale.":"Lucrările disponibile apar după verificarea contului de firmă."}</Text></View><Pill label={verified?"FIRMĂ VERIFICATĂ":"NEVERIFICATĂ"} tone={verified?"green":"amber"}/></PremiumCard>
    <View style={s.metrics}><Metric icon="search-outline" value={String(available.length)} label="disponibile"/><Metric icon="navigate-outline" value={String(active.length)} label="active"/><Metric icon="checkmark-circle-outline" value={String(completed.length)} label="finalizate"/></View>
    <PrimaryButton title="Vezi lucrările disponibile" onPress={()=>router.push("/(firma)/jobs")}/>
    <SectionTitle title="Oportunități recente"/>
    <InlineState loading={loading} error={error} onRetry={()=>void reload()}/>
    {!loading&&!error&&(available.length?available.slice(0,2).map(job=><JobCard key={job.id} job={job} firmView onPress={()=>router.push({pathname:"/(firma)/job-preview/[id]",params:{id:job.id}})}/>):<EmptyState icon="checkmark-circle-outline" title="Nu sunt lucrări disponibile momentan" body="Vei vedea aici doar lucrările eligibile din zonele tale de acoperire."/>)}
    <SectionTitle title="Activitate"/>
    <PremiumCard><Text style={s.infoTitle}>Dovezi și plăți controlate</Text><Text style={s.infoBody}>Începerea și finalizarea sunt confirmate de server numai după dovezile foto obligatorii. Starea financiară nu este calculată în aplicație.</Text><PrimaryButton secondary title="Vezi istoricul" icon="time-outline" onPress={()=>router.push("/(firma)/history")}/></PremiumCard>
  </AppScreen>;
}
const s=StyleSheet.create({verify:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},flex:{flex:1},verifyTitle:{fontSize:15,fontWeight:"800",color:colors.ink},verifyBody:{fontSize:11,lineHeight:17,color:colors.muted,marginTop:4,maxWidth:210},metrics:{flexDirection:"row",gap:8},infoTitle:{fontSize:16,fontWeight:"800",color:colors.ink},infoBody:{fontSize:13,lineHeight:20,color:colors.muted}});
