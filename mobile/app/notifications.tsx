import {useCallback,useRef,useState} from 'react';
import {useFocusEffect} from 'expo-router';
import {AppState,Linking,Text} from 'react-native';
import {api,normalizeApiError} from '@/api';
import {AppScreen,PremiumCard,PrimaryButton} from '@/mobileUi';
import {registerPush,unregisterCurrentPush,currentPushSettings} from '@/push';
import {readPushAccountStatus,type PushAccountStatus} from '@/pushSettingsCore';
import {colors} from '@/theme';
// SMS-ul de rezervă este gestionat exclusiv de backend; ecranul nu trimite SMS-uri.
type Status=PushAccountStatus&Awaited<ReturnType<typeof currentPushSettings>>;
export default function NotificationSettings(){
 const [status,setStatus]=useState<Status|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const lock=useRef(false),generation=useRef(0);
 const load=useCallback(async()=>{const version=++generation.current;setLoading(true);setError('');try{const [account,local]=await Promise.all([api<unknown>('/api/push/status'),currentPushSettings()]);const next={...readPushAccountStatus(account),...local};if(version===generation.current)setStatus(next);}catch(e){if(version===generation.current){setStatus(null);setError(normalizeApiError(e).message);}}finally{if(version===generation.current)setLoading(false);}},[]);
 useFocusEffect(useCallback(()=>{void load();const subscription=AppState.addEventListener('change',state=>{if(state==='active'&&!lock.current)void load();});return()=>{generation.current++;subscription.remove();};},[load]));
 async function change(activate:boolean){if(lock.current)return;lock.current=true;setBusy(true);setError('');setNotice('');try{if(activate){const accepted=await registerPush();setNotice(accepted?'Dispozitivul a fost înregistrat. Livrarea depinde de serviciul NITIDO și de permisiunile telefonului.':'Permisiunea nu a fost acordată. O poți modifica din setările telefonului.');}else{await unregisterCurrentPush();setNotice('Serverul a confirmat dezactivarea înregistrării locale.');}await load();}catch(e){setError(normalizeApiError(e).message);}finally{lock.current=false;setBusy(false);}}
 return <AppScreen eyebrow="NOTIFICĂRI" title="Notificări" subtitle="Verifică permisiunea telefonului și serviciul NITIDO." refreshing={loading} onRefresh={()=>{if(!lock.current)void load();}}>
 {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
 {notice?<Text accessibilityRole="alert" style={{color:colors.ink}}>{notice}</Text>:null}
 {status?<PremiumCard>
 <Text style={{fontSize:18,fontWeight:'800',color:colors.ink}}>Pe acest telefon</Text>
 <Text>Permisiune notificări: {status.permissionGranted?'acordată':'neacordată'}</Text>
 <Text>Înregistrare salvată local: {status.registeredLocally?'da':'nu'}</Text>
 <Text>Serviciu de trimitere NITIDO: {status.pushEnabled?'activat':'dezactivat momentan'}</Text>
 <Text>Dispozitive active în cont: {status.activeDevices}. Acest număr nu confirmă înregistrarea telefonului curent.</Text>
 <Text>Înregistrarea locală nu garantează livrarea. Serverul sau sistemul telefonului poate revoca permisiunea.</Text>
 <PrimaryButton title={status.registeredLocally?'Reînregistrează telefonul':'Înregistrează telefonul'} loading={busy} disabled={loading} onPress={()=>void change(true)}/>
 {status.registeredLocally?<PrimaryButton secondary title="Dezactivează pe acest telefon" disabled={busy||loading} onPress={()=>void change(false)}/>:null}
 </PremiumCard>:null}
 <PrimaryButton secondary title="Setările telefonului" disabled={busy} onPress={()=>void Linking.openSettings().catch(()=>setError('Setările telefonului nu au putut fi deschise.'))}/>
 <PrimaryButton secondary title="Verifică din nou" disabled={busy||loading} onPress={()=>void load()}/>
 </AppScreen>;
}
