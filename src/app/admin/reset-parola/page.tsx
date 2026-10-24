import type {Metadata} from 'next';
import {AdminPasswordReset} from '@/components/AdminPasswordReset';
export const metadata:Metadata={title:'Resetare parolă ADMIN — NÍTIDO',robots:{index:false,follow:false},referrer:'no-referrer',alternates:{canonical:null}};
export default function AdminResetPage(){return <AdminPasswordReset/>;}
