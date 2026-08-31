import { useEffect, useState } from "react";
import { Image, type ImageStyle, type StyleProp } from "react-native";
import { API_BASE_URL, getSessionToken } from "./api";
export function AuthorizedImage({path,style,alt}:{path:string;style:StyleProp<ImageStyle>;alt:string}){const [token,setToken]=useState<string|null>(null);useEffect(()=>{void getSessionToken().then(setToken)},[]);return <Image alt={alt} style={style} source={{uri:`${API_BASE_URL}${path}`,headers:token?{Authorization:`Bearer ${token}`}:{}}}/>;}
