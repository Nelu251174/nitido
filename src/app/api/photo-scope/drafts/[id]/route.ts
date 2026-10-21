import {NextRequest,NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {getCurrentUser} from '@/lib/auth';
import {ownScopeDraft,PhotoScopeError} from '@/lib/photoScope';
export async function GET(req:NextRequest,{params}:{params:Promise<{id:string}>}){const u=await getCurrentUser(req);if(!u||u.role!=='client')return NextResponse.json({error:'Autentificare client necesară'},{status:401});try{return NextResponse.json({draft:ownScopeDraft(db,u.id,(await params).id)},{headers:{'Cache-Control':'private, no-store'}});}catch(e){return NextResponse.json({error:e instanceof PhotoScopeError?e.message:'Descriere indisponibilă'},{status:e instanceof PhotoScopeError?e.status:503});}}
