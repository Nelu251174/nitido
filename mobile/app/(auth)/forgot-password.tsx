import {useState} from 'react';
import {Text,TextInput} from 'react-native';
import {router} from 'expo-router';
import {api,normalizeApiError} from '@/api';
import {requestPasswordRecovery} from '@/passwordRecoveryCore';
import {AppScreen,PremiumCard,PrimaryButton} from '@/mobileUi';
import {colors} from '@/theme';
export default function Forgot(){
 const [email,setEmail]=useState(''),[message,setMessage]=useState<string|null>(null),[error,setError]=useState<string|null>(null),[busy,setBusy]=useState(false);
 async function submit(){if(busy)return;setBusy(true);setError(null);try{setMessage(await requestPasswordRecovery(email,api))}catch(cause){setError(normalizeApiError(cause).message)}finally{setBusy(false)}}
 return <AppScreen eyebrow="ACCES CONT" title="Ai uitat parola?" subtitle="Cere un link pentru resetarea parolei. Linkul din email se deschide în pagina securizată NITIDO.">{message?<PremiumCard><Text accessibilityRole="alert" style={{color:colors.ink,lineHeight:22}}>{message}</Text><Text style={{color:colors.muted}}>După schimbarea parolei, revino în aplicație și autentifică-te din nou.</Text><PrimaryButton title="Înapoi la autentificare" onPress={()=>router.replace('/(auth)/login')}/></PremiumCard>:<><TextInput accessibilityLabel="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" editable={!busy} maxLength={254} placeholder="nume@email.ro" placeholderTextColor="#929A95" value={email} onChangeText={setEmail} style={{minHeight:56,borderRadius:16,borderWidth:1,borderColor:colors.border,backgroundColor:colors.white,paddingHorizontal:17,fontSize:16}}/>{error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}<PrimaryButton disabled={!email.includes('@')} loading={busy} title="Cere linkul de resetare" onPress={()=>void submit()}/><PrimaryButton secondary title="Contactează NITIDO" onPress={()=>router.push('/contact')}/></>}</AppScreen>;
}
