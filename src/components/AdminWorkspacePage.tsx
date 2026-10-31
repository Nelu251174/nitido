import {redirect} from 'next/navigation';
import {getAdminIdentity} from '@/lib/adminAuth';
import {hasAdminPermission,type AdminPermission} from '@/lib/adminRolesShared';

export async function requireAdminWorkspacePermission(permission:AdminPermission){
  const identity=await getAdminIdentity();
  if(!identity)redirect('/admin');
  if(!hasAdminPermission(identity.role,permission))redirect(identity.role==='finance'?'/admin/financiar':'/admin');
  return identity;
}
