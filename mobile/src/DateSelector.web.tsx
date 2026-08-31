import { StyleSheet, Text, TextInput, View } from "react-native";
import { colors } from "./theme";

export function DateSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return <View>
    <Text style={styles.label}>Data în format AAAA-LL-ZZ</Text>
    <TextInput accessibilityLabel="Data lucrării" value={value} onChangeText={onChange} placeholder="2026-09-01" inputMode="numeric" style={styles.input}/>
  </View>;
}

const styles = StyleSheet.create({label:{fontSize:12,color:colors.muted,marginBottom:7},input:{minHeight:56,borderWidth:1,borderColor:colors.border,borderRadius:16,paddingHorizontal:16,backgroundColor:colors.white,fontSize:16,fontWeight:"700",color:colors.ink}});
