import type {MarketingCountySummary} from '@/lib/adminMarketingCountyShared';
import styles from './AdminMarketingCounties.module.css';
export function AdminMarketingCountyProgress({name,job}:{name:string;job:NonNullable<MarketingCountySummary['job']>}){
 const importing=job.state==='importing',preparing=job.state==='preparing',queued=job.state==='queued';
 const imported=job.imported??0;
 return <div className={`${styles.progress} text-sm`} aria-live="polite">
  <div className={styles.inventory}>
  {preparing?<p>Se pregătește inventarul public pentru {name}. Emailurile vor apărea după import și verificare.</p>:queued?<p>{job.startedSeparately?'Pornirea este aprobată. Se așteaptă pregătirea inventarului public.':'Colectarea este în așteptare.'}</p>:<>
   <p>Inventar încărcat: {imported.toLocaleString('ro-RO')} / {job.total.toLocaleString('ro-RO')} firme</p>
   {importing?<p>Importul este în curs. Urmează colectarea și verificarea emailurilor publice.</p>:<p>Firme procesate: {job.processed.toLocaleString('ro-RO')} / {job.total.toLocaleString('ro-RO')}</p>}
   <progress className="w-full" value={importing?imported:job.processed} max={Math.max(1,job.total)} aria-label={`${importing?'Import inventar':'Colectare'} ${name}`}/>
  </>}
  </div>
  <div className={styles.sources}>
  {job.directory&&job.directory.total>0&&<p>Catalog public: {job.directory.processed} / {job.directory.total} pagini · {job.directory.blocked} blocate</p>}
  {job.websites&&job.websites.total>0&&<p>Pagini de contact: {job.websites.processed} / {job.websites.total} citite · {job.websites.blocked} inaccesibile sau nepermise</p>}
  {!preparing&&!queued&&!importing&&<p>{job.withoutEmail} fără email public găsit · {job.warnings} site-uri de verificat</p>}
  </div>
  <div className={styles.notes}>
  {job.startedSeparately&&<p>Pornit separat · continuă înainte de finalizarea celorlalte județe</p>}
  {!!job.directory?.needsReview&&<p>{job.directory.needsReview} profiluri din catalog necesită verificare. Celelalte pagini permise continuă să fie procesate.</p>}
  {job.message&&<p>{job.message}</p>}
  {job.nextAttemptAt&&<p>Reluare după {new Date(job.nextAttemptAt).toLocaleString('ro-RO')}</p>}
  </div>
 </div>;
}
