import {Stack} from "expo-router";import {StatusBar} from "expo-status-bar";import {AuthProvider,useAuth} from "@/auth";import {useNotificationRouting} from "@/push";import {colors} from "@/theme";
function NavigationBridge(){const {user}=useAuth();useNotificationRouting(user?.role??null);return <><StatusBar style="dark"/><Stack screenOptions={{headerStyle:{backgroundColor:colors.ivory},headerShadowVisible:false,headerTintColor:colors.ink,contentStyle:{backgroundColor:colors.ivory}}}/></>}
export default function RootLayout(){return <AuthProvider><NavigationBridge/></AuthProvider>}
