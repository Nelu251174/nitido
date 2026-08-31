import DateTimePicker from "@react-native-community/datetimepicker";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "./theme";
import { localIsoDate } from "./postJobCore";

export function DateSelector({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(`${value}T12:00:00`) : new Date();
  return <View>
    <Pressable accessibilityRole="button" accessibilityLabel="Alege data lucrării" onPress={() => setOpen(true)} style={styles.button}>
      <Text style={styles.text}>{value ? selected.toLocaleDateString("ro-RO", { day: "numeric", month: "long", year: "numeric" }) : "Alege data"}</Text>
    </Pressable>
    {open ? <DateTimePicker
      value={selected}
      mode="date"
      minimumDate={new Date()}
      onChange={(_, date) => { setOpen(false); if (date) onChange(localIsoDate(date)); }}
    /> : null}
  </View>;
}

const styles = StyleSheet.create({button:{minHeight:56,borderWidth:1,borderColor:colors.border,borderRadius:16,justifyContent:"center",paddingHorizontal:16,backgroundColor:colors.white},text:{fontSize:16,fontWeight:"700",color:colors.ink}});
