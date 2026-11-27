import {redirect} from 'next/navigation';
import {CollaborationWorkspace} from '@/components/CollaborationWorkspace';
import {getCurrentUser} from '@/lib/auth';

export default async function EmployeesPage() {
  const user = await getCurrentUser(undefined, {readOnly: true});
  if (!user) redirect('/login?next=/firma/angajati');
  if (user.role !== 'firma') redirect('/echipa');
  return <CollaborationWorkspace mode="employees"/>;
}
