import { useFocusEffect } from "expo-router";
import { useCallback, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { api, normalizeApiError } from "./api";
import { AppScreen, PremiumCard, PrimaryButton } from "./mobileUi";
import { colors } from "./theme";
type Message={role:"user"|"assistant";content:string};
const suggestions=["Cum funcționează plata?","Când vede firma adresa exactă?","Pot finaliza fără fotografia finală?","Cum contactez un om?"];
export function SupportChat(){
const [messages,setMessages]=useState<Message[]>([]);
const [question,setQuestion]=useState("");
const [busy,setBusy]=useState(false);
const [error,setError]=useState<string|null>(null);
const [available,setAvailable]=useState<boolean|null>(null);
const [checking,setChecking]=useState(false);
const generation=useRef(0);
const sending=useRef(false);
const check=useCallback(async()=>{
  const current=++generation.current;
  setChecking(true);setAvailable(null);
  try{const result=await api<{available?:unknown}>("/api/support/ai");
    if(current===generation.current){
      if(typeof result.available!=="boolean")throw new Error("Disponibilitatea AI nu a putut fi verificată.");
      setAvailable(result.available);setError(null);
    }
  }catch(cause){if(current===generation.current)setError(normalizeApiError(cause).message)}
  finally{if(current===generation.current)setChecking(false)}
},[]);
useFocusEffect(useCallback(()=>{void check();return()=>{generation.current++}},[check]));
async function send(value=question){
  const content=value.trim();if(!content||content.length>1000||sending.current||available!==true)return;
  sending.current=true;setBusy(true);setError(null);setQuestion(content);
  const current=generation.current;
  const next=[...messages,{role:"user" as const,content}];
  try{
    const result=await api<{answer?:unknown}>("/api/support/ai",{method:"POST",body:JSON.stringify({messages:next.slice(-8)})});
    if(typeof result.answer!=="string"||!result.answer.trim())throw new Error("Nu am primit un răspuns valid. Întrebarea este păstrată pentru reîncercare.");
    if(current===generation.current){setMessages([...next,{role:"assistant",content:result.answer}]);setQuestion("")}
  }catch(cause){if(current===generation.current)setError(normalizeApiError(cause).message)}
  finally{sending.current=false;setBusy(false)}
}
return <AppScreen eyebrow="SUPORT CONSULTATIV" title="Asistent AI NITIDO" subtitle="Întreabă liber despre cont, lucrări, dovezi, plăți sau reguli NITIDO."><PremiumCard><Text accessibilityLiveRegion="polite" style={s.answer}>{checking?"Se verifică disponibilitatea…":available===true?"Asistent disponibil":available===false?"Asistentul AI este temporar indisponibil.":"Disponibilitate necunoscută."}</Text><PrimaryButton title="Verifică disponibilitatea" disabled={checking||busy} onPress={()=>void check()}/></PremiumCard><View style={s.suggestions}>{suggestions.map(item=><Pressable accessibilityRole="button" key={item} disabled={available!==true||busy} accessibilityState={{disabled:available!==true||busy}} onPress={()=>void send(item)} style={s.chip}><Text style={s.chipText}>{item}</Text></Pressable>)}</View>{messages.length?messages.map((message,index)=><PremiumCard key={`${message.role}-${index}`} style={message.role==="user"?s.user:s.assistant}><Text style={s.role}>{message.role==="user"?"TU":"NITIDO AI"}</Text><Text selectable style={s.answer}>{message.content}</Text></PremiumCard>):<PremiumCard><Text style={s.answer}>Poți întreba și orice altceva despre NITIDO. Răspunsurile folosesc baza de cunoștințe și contextul permis rolului tău.</Text></PremiumCard>}<TextInput accessibilityLabel="Întrebare pentru Asistentul AI" editable={!busy} multiline maxLength={1000} value={question} onChangeText={setQuestion} placeholder="Scrie întrebarea ta…" placeholderTextColor={colors.muted} style={s.input}/>{error?<Text accessibilityRole="alert" style={s.error}>{error}</Text>:null}<PrimaryButton loading={busy} disabled={!question.trim()||busy||available!==true} title="Trimite" icon="send-outline" onPress={()=>void send()}/><Text style={s.human}>Pentru intervenție umană: 0341.402.403 · contact@nitido.ro</Text></AppScreen>}
const s=StyleSheet.create({suggestions:{flexDirection:"row",flexWrap:"wrap",gap:8},chip:{borderWidth:1,borderColor:colors.border,borderRadius:99,paddingHorizontal:12,paddingVertical:9,backgroundColor:colors.white},chipText:{fontSize:12,fontWeight:"700",color:colors.greenDark},user:{backgroundColor:colors.greenSoft},assistant:{backgroundColor:colors.white},role:{fontSize:10,fontWeight:"900",letterSpacing:1.2,color:colors.greenDark},answer:{fontSize:14,lineHeight:22,color:colors.ink},input:{minHeight:110,textAlignVertical:"top",borderWidth:1,borderColor:colors.border,borderRadius:18,backgroundColor:colors.white,padding:15,fontSize:15,lineHeight:22,color:colors.ink},error:{fontSize:13,lineHeight:19,color:colors.danger},human:{fontSize:11,lineHeight:17,color:colors.muted,textAlign:"center"}});
