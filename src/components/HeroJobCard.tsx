import Link from "next/link";
import type {SpaceType} from "@/lib/pricing";
import {formatHeroJobDate} from "@/lib/heroJobDate";
import {jobTypeLabel} from "@/lib/jobTypeLabels";

export type HeroJobCardData={
  serviceType:SpaceType|string;
  zone:string;
  surfaceM2:number;
  scheduledAt:string;
  estimatedPrice:string;
};

export function HeroJobCard({job}:{job:HeroJobCardData}){
  const schedule=formatHeroJobDate(job.scheduledAt);
  return <div className="absolute left-[-26px] top-10 w-[270px] rounded-2xl bg-white p-5 v2-shadow max-sm:left-3">
    <div className="flex items-start justify-between gap-3"><span className="pt-1 text-xs font-bold text-[#1b8a4c]">LUCRARE NOUĂ</span><time dateTime={job.scheduledAt} className="shrink-0 rounded-xl bg-[#fbf1dc] px-2.5 py-1.5 text-right text-[#94620a]"><span className="block text-[10px] font-semibold leading-4">{schedule.compactDate}</span><span className="block text-xs font-bold leading-4">{schedule.time}</span></time></div>
    <h3 className="mt-3 min-h-[24px] max-h-10 overflow-hidden text-[15px] font-bold leading-5">{jobTypeLabel(job.serviceType)}</h3>
    <p className="mt-1 text-sm text-[#5c6660]">{job.zone} · {job.surfaceM2} m² · astăzi</p>
    <p className="mt-2 flex items-center gap-2 text-xs font-medium text-[#5c6660]"><Calendar/><span>{schedule.longDate}</span></p>
    <div className="mt-4 text-2xl font-bold">{job.estimatedPrice}</div>
    <Link href="/signup?role=firma" className="v2-btn v2-btn-primary mt-4 w-full">Accept lucrarea</Link>
  </div>;
}

const Calendar=()=> <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></svg>;
