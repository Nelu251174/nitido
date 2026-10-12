import {useState} from 'react';
import {Linking,Text} from 'react-native';
import {AppScreen,PremiumCard,PrimaryButton} from '@/mobileUi';
import {colors} from '@/theme';
export default function Legal(){
 const [error,setError]=useState<string|null>(null);
 async function open(path:string){try{setError(null);await Linking.openURL('https://nitido.ro'+path)}catch{setError('Pagina nu a putut fi deschisă. Verifică conexiunea și reîncearcă.')}}
 return <AppScreen title="Confidențialitate și termeni"><PremiumCard><Text style={{color:colors.ink,lineHeight:22}}>Consultă documentele NITIDO în browserul dispozitivului.</Text><PrimaryButton secondary title="Politica de confidențialitate" onPress={()=>void open('/confidentialitate')}/><PrimaryButton secondary title="Termeni și condiții" onPress={()=>void open('/termeni')}/><PrimaryButton secondary title="Informații despre ștergerea contului" onPress={()=>void open('/stergere-cont')}/>{error?<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>:null}</PremiumCard></AppScreen>;
}
