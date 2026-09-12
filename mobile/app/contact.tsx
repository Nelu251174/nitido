import {useState} from 'react';
import {Linking,Text} from 'react-native';
import {router} from 'expo-router';
import {useAuth} from '@/auth';
import {AppScreen,PremiumCard,PrimaryButton,SectionTitle} from '@/mobileUi';
import {colors} from '@/theme';
export default function Contact(){
 const {user}=useAuth();const [error,setError]=useState('');
 async function open(url:string){setError('');try{await Linking.openURL(url);}catch{setError('Aplicația necesară nu a putut fi deschisă. Folosește datele de contact afișate mai jos.');}}
 const firm=user?.role==='firma';
 return <AppScreen eyebrow="AJUTOR NITIDO" title="Contact și suport" subtitle="Alege cum dorești să ne contactezi.">
 <PremiumCard><Text selectable style={{color:colors.ink,fontSize:18,fontWeight:'700'}}>0341 402 403</Text><Text style={{color:colors.muted}}>Apelul se deschide în aplicația de telefon a dispozitivului.</Text><PrimaryButton title="Sună NITIDO" icon="call-outline" onPress={()=>void open('tel:+40341402403')}/></PremiumCard>
 <PremiumCard><Text selectable style={{color:colors.ink,fontSize:18,fontWeight:'700'}}>contact@nitido.ro</Text><Text style={{color:colors.muted}}>Descrie problema și adaugă numărul lucrării, dacă există. Nu trimite parole sau date complete de card.</Text><PrimaryButton title="Scrie un email" icon="mail-outline" onPress={()=>void open('mailto:contact@nitido.ro?subject=NITIDO%20-%20Solicitare%20suport')}/><Text style={{color:colors.muted}}>Mesajul se deschide pentru redactare; îl trimiți din aplicația ta de email.</Text></PremiumCard>
 {error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}
 <SectionTitle title="Ajutor în cont"/>
 {user?<><PrimaryButton secondary title="Deschide asistentul NITIDO" icon="sparkles-outline" onPress={()=>router.push(firm?'/(firma)/support':'/(client)/support')}/><PrimaryButton secondary title="Conversațiile lucrărilor" icon="chatbubbles-outline" onPress={()=>router.push(firm?'/(firma)/messages':'/(client)/messages')}/><Text style={{color:colors.muted}}>Conversațiile cu firma sau clientul sunt asociate lucrărilor alocate. Pentru o problemă generală de cont, folosește contactele de mai sus.</Text></>:<PrimaryButton secondary title="Autentificare" onPress={()=>router.push('/(auth)/login')}/>}
 </AppScreen>;
}
