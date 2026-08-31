"use client";

import Link from "next/link";
import { FormEvent, useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };
type Status = { available: boolean; authenticated: boolean; role: "client" | "firma" | null; supportHref: string | null; unavailableMessage: string };

const suggestions = ["Cum postez o lucrare?", "Cum acceptă o firmă o lucrare?", "Cum funcționează plata?", "Când vede firma adresa exactă?", "Cum funcționează ratingul?", "Ce se întâmplă la no-show?", "Cum îmi modific contul?", "Cum verific statusul unei lucrări?", "Cum contactez firma care a acceptat?", "Cum verific plata unei lucrări?"];
const welcome: Message = { role: "assistant", content: "Bun venit! Îți pot explica modul în care funcționează conturile, lucrările, plățile, trackingul și ratingurile NITIDO. Cu ce te pot ajuta?" };

export function SupportCenter() {
  const [messages, setMessages] = useState<Message[]>([welcome]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => { fetch("/api/support/ai").then(r => r.json()).then(setStatus).catch(() => setStatus({ available: false, authenticated: false, role: null, supportHref: null, unavailableMessage: "Asistentul AI este temporar indisponibil. Poți contacta echipa NITIDO la 0341.402.403 sau contact@nitido.ro." })); }, []);
  useEffect(() => {
    if (messages.length <= 1 && !loading) return;
    const chat = chatMessagesRef.current;
    if (!chat) return;
    chat.scrollTo({ top: chat.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(question?: string) {
    const content = (question ?? input).trim();
    if (!content || loading || content.length > 1_000) return;
    const next = [...messages, { role: "user" as const, content }].slice(-12);
    setMessages(next); setInput(""); setError(null); setLoading(true);
    try {
      const response = await fetch("/api/support/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const data = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "Nu am putut obține un răspuns.");
      setMessages(current => [...current, { role: "assistant", content: data.answer! }]);
    } catch (err) { setError(err instanceof Error ? err.message : "Asistentul nu este disponibil momentan."); }
    finally { setLoading(false); }
  }
  function submit(event: FormEvent) { event.preventDefault(); void send(); }
  function reset() { setMessages([welcome]); setInput(""); setError(null); }

  return <>
    <section id="asistent-ai" className="v2-container pt-0 pb-0">
      <div className="grid min-h-fit grid-cols-[.72fr_1.28fr] items-start gap-10 max-[1000px]:grid-cols-1">
        <div><div className="v2-eyebrow">ASISTENT AI NITIDO</div><h2 className="v2-h2 mt-4">Ajutor rapid, 24/7, pentru întrebări despre platformă.</h2><p className="mt-5 leading-7 text-[#5c6660]">Asistentul îți explică pașii și poate folosi contextul contului autentificat numai în limitele permisiunilor tale.</p><div className="mt-8 rounded-2xl border border-[#c9dfd1] bg-[#e9f2ec] p-5"><div className="flex gap-3 text-[#14663a]"><Shield/><div><b className="text-sm">Suport, nu control asupra contului</b><p className="mt-2 text-sm leading-6 text-[#3e4842]">Asistentul AI oferă informații și suport. Operațiunile sensibile se execută doar prin fluxurile securizate ale platformei.</p></div></div></div><h3 className="mt-9 font-bold">Întrebări frecvente</h3><p className="mt-2 text-sm text-[#5c6660]">Poți întreba și orice altceva despre NITIDO.</p><div className="mt-4 flex flex-wrap gap-2">{suggestions.slice(0,6).map(question => <button type="button" onClick={() => void send(question)} disabled={loading || status?.available === false} key={question} className="rounded-full border border-[#d8d7d0] bg-white px-4 py-2 text-left text-xs font-semibold hover:border-[#1b8a4c] disabled:cursor-not-allowed disabled:opacity-50">{question}</button>)}</div></div>

        <div className="overflow-hidden rounded-[24px] border border-[#d8d7d0] bg-white shadow-[0_28px_80px_rgba(16,23,17,.12)]">
          <div className="flex items-center justify-between border-b border-[#e3e2da] px-6 py-5"><div className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1b8a4c] font-bold text-white">N</span><div><h3 className="font-bold">Asistent AI NITIDO</h3><span className="text-xs text-[#5c6660]">{status === null ? "Se verifică disponibilitatea…" : status.available ? "Disponibil" : "Indisponibil temporar"}</span></div></div><button type="button" onClick={reset} className="rounded-lg border border-[#e3e2da] px-3 py-2 text-xs font-semibold hover:bg-[#f4f3ee]">Conversație nouă</button></div>
          <div ref={chatMessagesRef} aria-live="polite" className="h-[430px] space-y-4 overflow-y-auto bg-[#faf9f5] p-6 max-sm:h-[390px] max-sm:p-4">{messages.map((message,index)=><div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm leading-6 ${message.role === "user" ? "rounded-br-md bg-[#1b8a4c] text-white" : "rounded-bl-md border border-[#e3e2da] bg-white text-[#29322d]"}`}>{message.content}</div></div>)}{loading&&<div className="flex justify-start"><div className="rounded-2xl rounded-bl-md border border-[#e3e2da] bg-white px-4 py-3 text-sm text-[#5c6660]"><span className="inline-flex gap-1"><i className="h-2 w-2 animate-pulse rounded-full bg-[#1b8a4c]"/><i className="h-2 w-2 animate-pulse rounded-full bg-[#1b8a4c] [animation-delay:150ms]"/><i className="h-2 w-2 animate-pulse rounded-full bg-[#1b8a4c] [animation-delay:300ms]"/></span></div></div>}</div>
          {status?.available === false && <div className="border-t border-[#efdba9] bg-[#fff8e8] px-6 py-4 text-sm leading-6 text-[#725117]">{status.unavailableMessage}</div>}
          {error && <div role="alert" className="border-t border-[#f0c8c8] bg-[#fff2f2] px-6 py-4 text-sm text-[#8f2f2f]"><b>Nu am putut răspunde.</b> {error}<div className="mt-2 flex gap-4"><a href="tel:0341402403" className="font-bold underline">Sună suportul</a><a href="mailto:contact@nitido.ro" className="font-bold underline">Trimite email</a></div></div>}
          <form onSubmit={submit} className="border-t border-[#e3e2da] p-4"><div className="flex gap-2"><label className="sr-only" htmlFor="support-question">Întrebarea ta</label><input id="support-question" value={input} onChange={event=>setInput(event.target.value)} maxLength={1000} disabled={loading || status?.available === false} placeholder="Scrie întrebarea ta…" className="min-w-0 flex-1 rounded-xl border border-[#d8d7d0] bg-white px-4 py-3 text-sm outline-none focus:border-[#1b8a4c] disabled:bg-[#f0efe9]"/><button type="submit" disabled={!input.trim() || loading || status?.available === false} className="v2-btn v2-btn-primary disabled:cursor-not-allowed disabled:opacity-50">Trimite</button></div><p className="mt-3 text-[11px] leading-5 text-[#7b847e]">Nu introduce parole, coduri de autentificare sau date complete ale cardului.</p></form>
        </div>
      </div>
    </section>

    <section className="bg-white"><div className="v2-container py-20"><div className="grid grid-cols-2 gap-5 max-md:grid-cols-1"><SupportCard icon="phone" title="Preferi să vorbești cu noi?" value="0341.402.403" text="Echipa NITIDO te poate ajuta în situațiile care necesită suport uman." href="tel:0341402403" action="Sună acum"/><SupportCard icon="mail" title="Scrie-ne" value="contact@nitido.ro" text="Pentru întrebări generale, documente sau situații care necesită analiză detaliată." href="mailto:contact@nitido.ro" action="Trimite email"/></div>{status?.authenticated && status.supportHref && <div className="mt-5 flex items-center justify-between gap-6 rounded-[20px] bg-[#101711] p-7 text-white max-sm:flex-col max-sm:items-start"><div><h3 className="text-xl font-bold">Suport pentru o lucrare existentă</h3><p className="mt-2 max-w-3xl text-sm leading-6 text-[#b8c1bb]">Dacă problema este legată de o lucrare activă, folosește conversația și mesajele asociate lucrării pentru ca echipa și participanții autorizați să aibă contextul corect.</p></div><Link href={status.supportHref} className="v2-btn shrink-0 bg-[#39c97c] text-[#101711]">Deschide panoul {status.role === "firma" ? "firmei" : "client"}</Link></div>}</div></section>
    <PrivacyNotice/><Faq/>
  </>;
}

function SupportCard({icon,title,value,text,href,action}:{icon:"phone"|"mail";title:string;value:string;text:string;href:string;action:string}){return <article className="rounded-[22px] border border-[#e3e2da] bg-[#f4f3ee] p-8"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#e4f0e8] text-[#14663a]">{icon === "phone" ? <Phone/> : <Mail/>}</span><h3 className="mt-8 text-2xl font-bold">{title}</h3><a href={href} className="mt-3 block text-xl font-bold text-[#14663a]">{value}</a><p className="mt-4 max-w-lg text-sm leading-6 text-[#5c6660]">{text}</p><a href={href} className="v2-btn v2-btn-primary mt-7">{action}</a></article>}
function PrivacyNotice(){return <section className="v2-container py-16"><div className="grid grid-cols-[auto_1fr] gap-5 rounded-[20px] border border-[#c9dfd1] bg-[#e9f2ec] p-7 max-sm:grid-cols-1"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#14663a]"><Shield/></span><div><h2 className="text-xl font-bold">Confidențialitate în conversație</h2><p className="mt-3 leading-7 text-[#3e4842]">Asistentul AI NITIDO nu îți va cere parola, codurile de autentificare sau datele complete ale cardului.</p><p className="mt-2 leading-7 text-[#3e4842]">Datele personale sunt folosite numai în limitele necesare pentru suport și conform permisiunilor contului autentificat.</p></div></div></section>}
function Faq(){const items=[["Cum postez o lucrare?","Autentifică-te ca client, deschide panoul client și selectează „Postează o lucrare”. Completează spațiul, locația, programarea și fotografiile opționale."],["Cum este aleasă firma?","Firmele eligibile sunt notificate simultan. Prima firmă eligibilă care acceptă prin server primește lucrarea."],["Când vede firma adresa exactă?","Numai firma căreia i-a fost alocată lucrarea vede detaliile exacte necesare execuției. Înainte de acceptare, adresa rămâne protejată."],["Cum funcționează plata?","Plata este urmărită prin stări distincte. O autorizare eșuată nu alocă fals lucrarea, iar acțiunile de plată rămân în fluxurile securizate."],["Ce se întâmplă dacă firma nu se prezintă?","Clientul poate raporta no-show pentru propria lucrare, conform stării acesteia. Incidentul este înregistrat și plata autorizată este anulată prin fluxul securizat."],["Cum contactez suportul?","Sună la 0341.402.403 sau scrie la contact@nitido.ro. Pentru o lucrare activă, folosește și mesajele asociate din cont."],["Cum îmi șterg sau modific contul?","Interfața actuală nu oferă un flux complet pentru aceste operațiuni. Contactează suportul la 0341.402.403 sau contact@nitido.ro pentru verificare și ajutor."]];return <section className="bg-white"><div className="v2-container py-20"><div className="v2-eyebrow">SUPORT RAPID</div><h2 className="v2-h2 mt-4">Răspunsuri la întrebările esențiale</h2><div className="mt-10 grid grid-cols-2 gap-4 max-md:grid-cols-1">{items.map(([q,a])=><details key={q} className="group rounded-2xl border border-[#e3e2da] bg-[#f4f3ee] p-6"><summary className="cursor-pointer list-none pr-8 font-bold marker:hidden">{q}<span className="float-right text-[#1b8a4c] group-open:rotate-45">+</span></summary><p className="mt-4 text-sm leading-6 text-[#5c6660]">{a}</p></details>)}</div></div></section>}
const Shield=()=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M12 3 20 6v5c0 5-3.4 8.4-8 10-4.6-1.6-8-5-8-10V6z"/></svg>;
const Phone=()=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><path d="M5 4h4l2 5-3 2a16 16 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A15 15 0 0 1 3 6a2 2 0 0 1 2-2Z"/></svg>;
const Mail=()=> <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>;
