import {UiText} from '@/components/UiText';
/** Design previews cannot claim a real booking, payment, location or message. */
export function DemoPreviewNotice(){
 return <aside data-demo-notice className="mb-5 rounded-xl border-2 border-amber-500 bg-amber-50 px-5 py-4 text-slate-900"><strong className="mr-3 rounded bg-amber-200 px-2 py-1 text-sm"><UiText text="DEMO"/></strong><UiText text="Previzualizare cu date demonstrative"/><div className="mt-3"><a className="font-semibold underline" href="/login"><UiText text="Autentifică-te pentru a vedea lucrările"/></a></div></aside>;
}
