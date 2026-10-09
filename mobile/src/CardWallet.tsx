import {useCallback,useEffect,useState} from "react";
import {Alert,Linking,Pressable,Text,View} from "react-native";
import {api} from "./api";
import {useAuth} from "./auth";
import {PremiumCard,PrimaryButton} from "./mobileUi";
import {colors} from "./theme";
import {checkoutTarget,type Wallet} from "./cardWalletCore";
import {readCardSetup,writeCardSetup} from "./cardSetupStore";

export function CardWallet({selected,onLoaded,onSelect,onBusy}:{selected?:string;onLoaded?:(wallet:Wallet)=>void;onSelect?:(id:string)=>void;onBusy?:(busy:boolean)=>void}) {
 const {user}=useAuth();const userId=user?.id;
 const [wallet,setWallet]=useState<Wallet|null>(null),[busy,setBusy]=useState(false),[pending,setPending]=useState<string|null>(null),[error,setError]=useState<string|null>(null);
 const refresh=useCallback(async()=>{const data=await api<Wallet>("/api/payments/card");setWallet(data);onLoaded?.(data);},[onLoaded]);
 useEffect(()=>{if(!userId)return;let alive=true;void (async()=>{try{const data=await api<Wallet>("/api/payments/card");const saved=await readCardSetup(userId);if(alive){setWallet(data);setPending(saved);onLoaded?.(data);}}catch{if(alive)setError("Cardurile nu au putut fi încărcate.");}})();return()=>{alive=false;};},[userId,onLoaded]);
 async function run(action:()=>Promise<void>){if(busy)return;setBusy(true);onBusy?.(true);setError(null);try{await action();}catch(e){setError(e instanceof Error?e.message:"Operațiunea nu a reușit.");}finally{setBusy(false);onBusy?.(false);}}
 async function add(){if(!userId||!wallet||wallet.cards.length>=3)return;await run(async()=>{const target=checkoutTarget(await api<{url:string;sessionId:string}>("/api/payments/checkout",{method:"POST",body:JSON.stringify({returnTo:"mobile"})}));await writeCardSetup(userId,target.sessionId);setPending(target.sessionId);await Linking.openURL(target.url);});}
 async function confirm(){if(!pending||!userId)return;await run(async()=>{await api("/api/payments/card",{method:"POST",body:JSON.stringify({sessionId:pending})});await writeCardSetup(userId,null);setPending(null);await refresh();});}
 async function manage(id:string,method:"PATCH"|"DELETE"){await run(async()=>{await api("/api/payments/card",{method,body:JSON.stringify({cardId:id})});await refresh();});}
 function remove(id:string){Alert.alert("Elimini cardul?","Plățile existente rămân păstrate.",[{text:"Renunță",style:"cancel"},{text:"Elimină",style:"destructive",onPress:()=>void manage(id,"DELETE")}]);}
 return <PremiumCard><Text style={{fontSize:18,fontWeight:"800",color:colors.ink}}>{onSelect?"Cardul pentru această lucrare":"Cardurile tale"}</Text>
  <Text style={{color:colors.muted}}>{wallet?`${wallet.cards.length} din 3 carduri salvate`:"Se încarcă…"}</Text>
  {wallet?.cards.map(card=><View key={card.id} style={{padding:14,borderWidth:1,borderColor:card.id===selected?colors.green:colors.border,borderRadius:14,gap:8}}>
   <Pressable disabled={busy||!onSelect} accessibilityRole={onSelect?"radio":undefined} accessibilityState={onSelect?{checked:card.id===selected}:undefined} onPress={()=>onSelect?.(card.id)}>
    <Text style={{fontWeight:"700",color:colors.ink}}>{card.brand?.toUpperCase()??"Card"} ···· {card.last4??"—"}{card.isDefault?" · Implicit":""}</Text>
    <Text style={{fontSize:12,color:colors.muted}}>{card.expMonth&&card.expYear?`Expiră ${String(card.expMonth).padStart(2,"0")}/${card.expYear}`:""}</Text>
    {onSelect&&<Text style={{fontSize:12,color:colors.greenDark}}>{card.id===selected?"Ales pentru această lucrare":"Alege acest card"}</Text>}
   </Pressable>
   {!card.isDefault&&<PrimaryButton secondary disabled={busy} title="Setează implicit" onPress={()=>void manage(card.id,"PATCH")}/>}
   <Pressable disabled={busy} accessibilityRole="button" onPress={()=>remove(card.id)}><Text style={{color:colors.muted,textDecorationLine:"underline"}}>Elimină</Text></Pressable>
  </View>)}
  {pending?<><Text style={{color:colors.muted}}>După completarea formularului Stripe, verifică adăugarea cardului.</Text><PrimaryButton title="Verifică adăugarea" loading={busy} disabled={busy} onPress={()=>void confirm()}/><PrimaryButton secondary title="Am anulat adăugarea" disabled={busy} onPress={()=>void run(async()=>{if(userId)await writeCardSetup(userId,null);setPending(null);})}/></>:<PrimaryButton secondary title="Adaugă card nou" disabled={busy||!wallet||!wallet.stripeConfigured||wallet.cards.length>=3} loading={busy} onPress={()=>void add()}/>}
  {wallet&&wallet.cards.length>=3&&<Text style={{fontSize:12,color:colors.muted}}>Ai atins limita de 3 carduri. Elimină unul pentru a adăuga altul.</Text>}
  {error&&<Text accessibilityRole="alert" style={{color:colors.danger}}>{error}</Text>}
  <Text style={{fontSize:12,color:colors.muted}}>Cardul ales se folosește la preluarea lucrării. Datele cardului sunt procesate de Stripe.</Text>
 </PremiumCard>;
}
