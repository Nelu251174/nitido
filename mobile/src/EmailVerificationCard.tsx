import {useCallback,useRef,useState,useEffect} from 'react';
import {Text,AppState} from 'react-native';
import {useFocusEffect} from 'expo-router';
import {api} from './api';
import {PremiumCard,PrimaryButton} from './mobileUi';
import {colors} from './theme';
import {readVerificationStatus,readResendResult,verificationDescription,type VerificationStatus} from './emailVerificationCore';
export function EmailVerificationCard(){
 const [status,setStatus]=useState<VerificationStatus|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
 const generation=useRef(0),sending=useRef(false);
 const refresh=useCallback(async()=>{const current=++generation.current;setError('');try{const result=readVerificationStatus(await api('/api/auth/verify-email'));if(current===generation.current)setStatus(result)}catch(e){if(current===generation.current){setStatus(null);setError(e instanceof Error?e.message:'Verificarea nu a reușit.')}}},[]);
 useFocusEffect(useCallback(()=>{void refresh();return()=>{generation.current++}},[refresh]));
 useEffect(()=>{const sub=AppState.addEventListener('change',next=>{if(next==='active')void refresh()});return()=>sub.remove()},[refresh]);
 async function resend(){if(sending.current)return;sending.current=true;setBusy(true);setError('');setMessage('');const current=++generation.current;try{const result=readResendResult(await api('/api/auth/verify-email',{method:'POST',body:JSON.stringify({action:'resend'})}));if(current===generation.current){if(result==='verified')setStatus({verified:true,configured:true});else setMessage('Furnizorul a acceptat mesajul. Verifică Inbox și Spam. Livrarea nu este încă confirmată.')}}catch(e){if(current===generation.current)setError(e instanceof Error?e.message:'Emailul nu a putut fi trimis.')}finally{sending.current=false;setBusy(false)}}
 return <PremiumCard><Text style={{fontSize:18,fontWeight:'700',color:colors.ink}}>Confirmarea emailului</Text><Text style={{fontSize:14,lineHeight:22,color:colors.muted}}>{status?verificationDescription(status):error?'Stare necunoscută.':'Se verifică adresa…'}</Text>{error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}{message?<Text accessibilityRole="alert" style={{color:colors.greenDark}}>{message}</Text>:null}{status&&!status.verified&&status.configured?<PrimaryButton title="Retrimite confirmarea" icon="mail-outline" loading={busy} onPress={()=>void resend()}/>:null}<PrimaryButton secondary title="Actualizează starea emailului" disabled={busy} icon="refresh-outline" onPress={()=>void refresh()}/></PremiumCard>
}
