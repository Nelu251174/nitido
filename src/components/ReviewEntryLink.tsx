"use client";
import Link from 'next/link';
import {trackBookingFunnel} from '@/lib/bookingFunnel';
export function ReviewEntryLink({href,children,className}:{href:string;children:React.ReactNode;className?:string}){return <Link className={className} href={href} onClick={()=>trackBookingFunnel(href.includes('evaluari-lucrari')?'review_start':'reviews_open')}>{children}</Link>;}
