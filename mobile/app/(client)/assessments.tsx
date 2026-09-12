import {useCallback,useRef,useState} from 'react';
import {useFocusEffect,useLocalSearchParams} from 'expo-router';
import {Alert,Pressable,StyleSheet,Text,TextInput,View} from 'react-native';
import {api} from '@/api';
import {AppScreen,PremiumCard,PrimaryButton,SectionTitle,Pill} from '@/mobileUi';
import {colors} from '@/theme';
import {actOnAssessment,assessmentInput,assessmentIsOpen,assessmentSubmitter,ASSESSMENT_CATEGORIES,emptyAssessment,QUANTITIES,STATUS_LABELS,type Assessment,type AssessmentDraft} from '@/assessmentCore';
const message=(e:unknown)=>e instanceof Error?e.message:'Conexiunea a fost întreruptă. Reîncearcă.';
export default function Assessments(){
 const params=useLocalSearchParams<{city?:string;sqm?:string}>();
 const [draft,setDraft]=useState(()=>emptyAssessment(typeof params.city==='string'?params.city.slice(0,100):'',typeof params.sqm==='string'?params.sqm:'100'));
 const [items,setItems]=useState<Assessment[]>([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false);
 const lock=useRef(false),generation=useRef(0);
 const submit=useRef<ReturnType<typeof assessmentSubmitter>|null>(null);
 const load=useCallback(async()=>{const current=++generation.current;setLoading(true);try{const result=await api<{requests:Assessment[]}>('/api/assessments');if(current!==generation.current)return;if(!Array.isArray(result.requests))throw new Error('Lista cererilor nu a putut fi citită.');setItems(result.requests);setLoaded(true);}catch(e){if(current===generation.current)setError(message(e));}finally{if(current===generation.current)setLoading(false);}},[]);
 useFocusEffect(useCallback(()=>{void load();return()=>{generation.current++;};},[load]));
 function patch<K extends keyof AssessmentDraft>(key:K,value:AssessmentDraft[K]){setDraft(old=>({...old,[key]:value}));setNotice('');}
 async function create(){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{submit.current ??= assessmentSubmitter(api,()=>`mobile-assessment-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`);const id=await submit.current(assessmentInput(draft));setNotice(`Cererea a fost înregistrată. Referință: ${id}. Răspunsul va apărea în cont.`);setDraft(old=>({...old,notes:''}));await load();}catch(e){setError(message(e));}finally{lock.current=false;setBusy(false);}}
 async function act(item:Assessment,action:'reply'|'cancel',body=''){if(lock.current)return false;lock.current=true;setBusy(true);setError('');setNotice('');try{await actOnAssessment(api,item,action,body);setNotice(action==='cancel'?'Cererea a fost anulată.':'Completarea a fost înregistrată.');await load();return true;}catch(e){setError(message(e));await load();return false;}finally{lock.current=false;setBusy(false);}}
 return <AppScreen eyebrow="EVALUARE PERSONALIZATĂ" title="Solicită o evaluare" subtitle="Descrie lucrarea înainte de rezervare." refreshing={loading} onRefresh={()=>{if(!busy){setError('');void load();}}}>
  <PremiumCard><Text style={styles.body}>Echipa NITIDO analizează cererea și răspunde aici. Trimiterea nu creează o rezervare, nu stabilește prețul final și nu autorizează cardul.</Text></PremiumCard>
  {error?<Text accessibilityRole="alert" style={styles.error}>{error}</Text>:null}{notice?<Text accessibilityRole="alert" style={styles.body}>{notice}</Text>:null}
  <PremiumCard><Text style={styles.heading}>Serviciu solicitat</Text><View style={styles.choices}>{ASSESSMENT_CATEGORIES.map(([key,label])=><Choice key={key} label={label} selected={draft.category===key} disabled={busy} onPress={()=>patch('category',key)}/>)}</View>
  <Field label="Localitate" value={draft.city} disabled={busy} maxLength={100} onChange={v=>patch('city',v)}/>
  {QUANTITIES.map(([key,label])=><Field key={key} label={label} value={draft[key]} disabled={busy} numeric maxLength={10} onChange={v=>patch(key,v)}/>)}
  <Text style={styles.heading}>Dificultate declarată</Text><View style={styles.choices}>{([['light','Redusă'],['normal','Obișnuită'],['heavy','Ridicată']] as const).map(([key,label])=><Choice key={key} label={label} selected={draft.difficulty===key} disabled={busy} onPress={()=>patch('difficulty',key)}/>)}</View>
  <Field label="Ce trebuie făcut? Materiale, acces, preferințe și perioada dorită" value={draft.notes} disabled={busy} multiline maxLength={4000} onChange={v=>patch('notes',v)}/><Text style={styles.body}>{draft.notes.length}/4000 caractere. Vizibil pentru tine și administrarea NITIDO. Nu introduce parole sau coduri de acces.</Text>
  <PrimaryButton title="Trimite spre evaluare" loading={busy} onPress={()=>void create()}/></PremiumCard>
  <SectionTitle title="Cererile tale"/><PrimaryButton secondary title="Actualizează cererile" disabled={busy||loading} onPress={()=>{setError('');void load();}}/>
  <Text style={styles.body}>Ultimele 200 de cereri. Trage în jos pentru actualizare.</Text>
  {loaded&&!items.length?<Text style={styles.body}>Nu ai cereri de evaluare înregistrate.</Text>:null}
  {items.map(item=><Thread key={item.id} item={item} busy={busy} onAction={act}/>)}
 </AppScreen>;
}
function Thread({item,busy,onAction}:{item:Assessment;busy:boolean;onAction:(item:Assessment,action:'reply'|'cancel',body?:string)=>Promise<boolean>}){
 const [reply,setReply]=useState('');
 return <PremiumCard><Text style={styles.heading}>{ASSESSMENT_CATEGORIES.find(([key])=>key===item.category)?.[1]??item.category} · {item.city}</Text><Pill label={STATUS_LABELS[item.status]??item.status} tone={item.status==='needs_details'?'amber':'neutral'}/><Text style={styles.body}>{new Date(item.createdAt).toLocaleString('ro-RO')} · {item.sqm} m²</Text><Text style={styles.body}>{item.notes}</Text>
 <Text style={styles.body}>Camere: {item.rooms} · Băi: {item.bathrooms} · Aparate: {item.appliances} · Geamuri: {item.windowsSqm} m² · Lenjerie: {item.linenSets} seturi · Ore suplimentare: {item.extraHours}</Text>
 {item.messages.map(m=><View key={m.id} style={styles.message}><Text style={styles.heading}>{m.author==='admin'?'Echipa NITIDO':'Tu'}</Text><Text style={styles.body}>{m.body}</Text><Text style={styles.body}>{new Date(m.createdAt).toLocaleString('ro-RO')}</Text></View>)}
 {assessmentIsOpen(item)?<><Field label="Adaugă o completare" value={reply} multiline maxLength={4000} disabled={busy} onChange={setReply}/><PrimaryButton title="Trimite completarea" disabled={busy||!reply.trim()} onPress={()=>void onAction(item,'reply',reply).then(ok=>{if(ok)setReply('');})}/><PrimaryButton secondary title="Anulează cererea" disabled={busy} onPress={()=>Alert.alert('Anulezi cererea?','Cererea va fi închisă.',[{text:'Păstrează',style:'cancel'},{text:'Anulează cererea',style:'destructive',onPress:()=>void onAction(item,'cancel')}])}/></>:null}</PremiumCard>;
}
function Choice({label,selected,disabled,onPress}:{label:string;selected:boolean;disabled:boolean;onPress:()=>void}){return <Pressable accessibilityRole="radio" accessibilityState={{checked:selected,disabled}} disabled={disabled} onPress={onPress} style={[styles.choice,selected&&styles.selected]}><Text style={styles.body}>{label}</Text></Pressable>;}
function Field({label,value,onChange,disabled,numeric,multiline,maxLength}:{label:string;value:string;onChange:(v:string)=>void;disabled:boolean;numeric?:boolean;multiline?:boolean;maxLength:number}){return <View style={styles.field}><Text style={styles.heading}>{label}</Text><TextInput accessibilityLabel={label} editable={!disabled} value={value} onChangeText={onChange} keyboardType={numeric?'number-pad':'default'} multiline={multiline} maxLength={maxLength} style={[styles.input,multiline&&styles.multiline]}/></View>;}
const styles=StyleSheet.create({body:{fontSize:14,lineHeight:21,color:colors.ink},heading:{fontSize:15,fontWeight:'700',color:colors.ink},error:{color:colors.danger,fontSize:14},choices:{flexDirection:'row',flexWrap:'wrap',gap:8},choice:{padding:12,borderWidth:1,borderColor:colors.border,borderRadius:12},selected:{backgroundColor:colors.greenSoft,borderColor:colors.green},field:{gap:6},input:{borderWidth:1,borderColor:colors.border,borderRadius:10,padding:12,fontSize:16,color:colors.ink,minHeight:48},multiline:{minHeight:120,textAlignVertical:'top'},message:{borderLeftWidth:3,borderColor:colors.green,paddingLeft:10,gap:5}});
