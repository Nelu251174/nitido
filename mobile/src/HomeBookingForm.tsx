import {useState} from "react";
import {router} from "expo-router";
import {Pressable,StyleSheet,Text,TextInput,View} from "react-native";
import {DateSelector} from "./DateSelector";
import {PremiumCard,PrimaryButton} from "./mobileUi";
import {JOB_TYPE_LABELS} from "./jobTypes";
import {colors} from "./theme";
import type {SpaceType} from "./types";

export function HomeBookingForm(){
 const [city,setCity]=useState("București"),[sqm,setSqm]=useState("80"),[date,setDate]=useState("");
 const [spaceType,setSpaceType]=useState<SpaceType>("apartament");
 return <PremiumCard>
  <Text style={s.label}>Localitate</Text><TextInput accessibilityLabel="Localitate" value={city} onChangeText={setCity} maxLength={120} style={s.input}/>
  <Text style={s.label}>Tipul spațiului</Text><View style={s.choices}>{Object.entries(JOB_TYPE_LABELS).map(([key,label])=><Pressable key={key} accessibilityRole="radio" accessibilityState={{checked:spaceType===key}} onPress={()=>setSpaceType(key as SpaceType)} style={[s.choice,spaceType===key&&s.selected]}><Text style={s.choiceText}>{label.replace("Curățenie ","")}</Text></Pressable>)}</View>
  <Text style={s.label}>Suprafață, m²</Text><TextInput accessibilityLabel="Suprafață, metri pătrați" keyboardType="number-pad" value={sqm} onChangeText={v=>setSqm(v.replace(/\D/g,""))} maxLength={6} style={s.input}/>
  <Text style={s.label}>Data dorită</Text><DateSelector value={date} onChange={setDate}/>
  <PrimaryButton title="Vezi opțiunile" disabled={!city.trim()||Number(sqm)<=0} onPress={()=>router.push({pathname:"/(client)/post",params:{city:city.trim(),sqm,spaceType,date}})}/>
 </PremiumCard>
}
const s=StyleSheet.create({label:{fontSize:13,fontWeight:"700",color:colors.ink,marginTop:4},input:{minHeight:48,borderWidth:1,borderColor:colors.border,borderRadius:8,paddingHorizontal:12,fontSize:16,color:colors.ink,backgroundColor:colors.white},choices:{flexDirection:"row",flexWrap:"wrap",gap:8},choice:{minHeight:44,paddingHorizontal:12,paddingVertical:12,borderWidth:1,borderColor:colors.border,borderRadius:8},selected:{borderColor:colors.green,backgroundColor:colors.greenSoft},choiceText:{fontSize:13,color:colors.ink}});
