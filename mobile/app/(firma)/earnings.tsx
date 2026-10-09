import { StyleSheet, Text, View } from "react-native";
import { paymentState } from "@/firmOperations";
import { jobTypeLabel } from "@/jobTypes";
import { AppScreen, EmptyState, InlineState, Pill, PremiumCard, SectionTitle } from "@/mobileUi";
import { colors } from "@/theme";
import { useJobs } from "@/useJobs";

export default function Earnings(){
  const {jobs,loading,error,reload}=useJobs();
  const financialJobs=jobs.filter(job=>job.financial||typeof job.firm_payout==="number");
  const pending=financialJobs.filter(job=>!["processed","paid"].includes(job.financial?.payoutStatus??"pending")).length;
  const paid=financialJobs.filter(job=>["processed","paid"].includes(job.financial?.payoutStatus??"")).length;
  return <AppScreen eyebrow="VALORI AUTORITATIVE" title="Încasări" subtitle="Sumele și stările sunt afișate exclusiv din răspunsul backendului NITIDO.">
    <View style={s.metrics}><Metric value={String(pending)} label="în așteptare"/><Metric value={String(paid)} label="procesate"/></View>
    <SectionTitle title="Situația lucrărilor"/>
    <InlineState loading={loading} error={error} onRetry={()=>void reload()}/>
    {!loading&&!error&&(financialJobs.length?financialJobs.map(job=><PremiumCard key={job.id}>
      <View style={s.row}><View style={s.flex}><Text style={s.title}>{jobTypeLabel(job.space_type)}</Text><Text style={s.meta}>{job.city} · {job.completed_at?new Date(job.completed_at).toLocaleDateString("ro-RO"):"lucrare activă"}</Text></View><Pill label={paymentState(job)} tone={job.financial?.paymentStatus==="captured"?"green":"amber"}/></View>
      <View style={s.row}><Text style={s.label}>Tu încasezi</Text><Text style={s.amount}>{typeof job.financial?.firmPayout==="number"?`${job.financial.firmPayout} lei`:typeof job.firm_payout==="number"?`${job.firm_payout} lei`:"—"}</Text></View>
      <Text style={s.note}>Timpul până la apariția fondurilor în contul bancar depinde de procesator și de bancă.</Text>
    </PremiumCard>):<EmptyState icon="wallet-outline" title="Nu există încă încasări" body="Stările financiare vor apărea numai după ce sunt confirmate de backend."/>)}
  </AppScreen>;
}
function Metric({value,label}:{value:string;label:string}){return <PremiumCard style={s.metric}><Text style={s.metricValue}>{value}</Text><Text style={s.label}>{label}</Text></PremiumCard>}
const s=StyleSheet.create({metrics:{flexDirection:"row",gap:10},metric:{flex:1},metricValue:{fontSize:28,fontWeight:"800",color:colors.ink},row:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",gap:12},flex:{flex:1},title:{fontSize:16,fontWeight:"800",color:colors.ink},meta:{fontSize:12,color:colors.muted,marginTop:4},label:{fontSize:12,color:colors.muted},amount:{fontSize:20,fontWeight:"800",color:colors.ink},note:{fontSize:11,lineHeight:17,color:colors.muted}});
