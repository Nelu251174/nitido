import {useCallback,useEffect,useState} from 'react';
import {Text} from 'react-native';
import {useAuth} from '@/auth';
import {api,normalizeApiError} from '@/api';
import {deletionStatus,readDeletionRequest,requestAccountDeletion,type DeletionResult} from '@/accountDeletionCore';
import {AppScreen,InlineState,PremiumCard,PrimaryButton} from '@/mobileUi';
import {colors} from '@/theme';
export default function DeleteAccount(){
 const {user,loading:authLoading}=useAuth();
 const [data,setData]=useState<DeletionResult|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[confirming,setConfirming]=useState(false);
 const refresh=useCallback(async()=>{setLoading(true);try{setData(await readDeletionRequest(api));setError(null)}catch(cause){setError(normalizeApiError(cause).message)}finally{setLoading(false)}},[]);
 useEffect(()=>{if(user)void Promise.resolve().then(refresh)},[user,refresh]);
 async function submit(){if(busy)return;setBusy(true);setError(null);try{setData(await requestAccountDeletion(api));setConfirming(false)}catch(cause){setError(normalizeApiError(cause).message)}finally{setBusy(false)}}

 if(authLoading)return <AppScreen title="Ștergerea contului"><Text>Se verifică sesiunea…</Text></AppScreen>;
 if(!user)return <AppScreen title="Ștergerea contului"><Text>Autentifică-te pentru a trimite cererea din contul tău.</Text></AppScreen>;
 return <AppScreen title="Ștergerea contului" subtitle="Poți solicita ștergerea contului și a datelor asociate."><InlineState loading={loading} error={error} onRetry={()=>void refresh()}/><PremiumCard><Text style={{color:colors.ink,lineHeight:22}}>Cererea va fi analizată de NITIDO. Înregistrarea ei nu înseamnă că datele au fost deja șterse. Lucrările în curs și obligațiile legale de păstrare a unor date vor fi verificate înainte de finalizare.</Text>{data?.request?<><Text accessibilityRole="alert" style={{color:colors.greenDark,fontWeight:'700'}}>{deletionStatus(data.request)}</Text><Text style={{color:colors.muted}}>{data.message}</Text><Text style={{color:colors.muted}}>Înregistrată: {new Date(data.request.createdAt).toLocaleDateString('ro-RO')}</Text></>:confirming?<><Text style={{color:colors.ink,lineHeight:22}}>Confirmi că dorești înregistrarea cererii de ștergere pentru acest cont? Datele nu sunt șterse imediat.</Text><PrimaryButton title="Înregistrează cererea" loading={busy} onPress={()=>void submit()}/><PrimaryButton secondary title="Renunță" disabled={busy} onPress={()=>setConfirming(false)}/></>:<PrimaryButton title="Solicită ștergerea contului" disabled={loading||Boolean(error)} onPress={()=>setConfirming(true)}/>}</PremiumCard></AppScreen>;
}
