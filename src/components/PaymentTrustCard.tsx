import Image from "next/image";

const paymentBrands = [
  { src: "/payment/visa.svg", alt: "Visa", width: 56, height: 28 },
  { src: "/payment/mastercard.svg", alt: "Mastercard", width: 48, height: 32 },
  { src: "/payment/stripe.svg", alt: "Stripe", width: 30, height: 30 },
  { src: "/payment/revolut.svg", alt: "Revolut", width: 30, height: 30 },
  { src: "/payment/wise.svg", alt: "Wise", width: 58, height: 30 },
];

const steps = [
  ["1", "AUTORIZARE", "Serverul inițiază fluxul de autorizare."],
  ["2", "LUCRARE FINALIZATĂ", "Firma confirmă finalizarea prin fluxul autorizat."],
  ["3", "PLATĂ ELIBERATĂ", "Platforma confirmă eliberarea după răspunsul reușit al procesatorului."],
] as const;

export function PaymentTrustCard() {
  return <article className="v2-card h-full p-5 lg:p-6"><div className="v2-eyebrow">PLATĂ PROTEJATĂ</div><h3 className="mt-3 text-2xl font-bold">Plata rămâne controlată până la final.</h3><p className="mt-4 text-sm leading-6 text-[#5c6660]">Fluxul este configurat pentru autorizare cu capturare manuală. Suma poate rămâne rezervată pe card, sub formă de hold / preautorizare, numai după confirmarea procesatorului.</p>
    <div className="mt-5 grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-3 xl:grid-cols-5" aria-label="Rețele și mărci financiare compatibile">{paymentBrands.map(brand=><span key={brand.alt} className="flex h-10 min-w-0 items-center justify-center rounded-xl border border-[#d8d7d0] bg-white px-2"><Image src={brand.src} alt={brand.alt} width={brand.width} height={brand.height} className="h-5 max-w-full w-auto object-contain"/></span>)}</div>
    <p className="mt-2 text-[11px] leading-4 text-[#707a74]">Visa și Mastercard sunt rețele de card. Revolut și Wise sunt afișate orientativ ca mărci de card; procesarea NITIDO este realizată prin Stripe, iar acceptarea depinde de card și emitent.</p>
    <div className="mt-5 rounded-2xl bg-[#101711] p-5 text-white"><div className="text-xs font-bold text-[#8fd8ae]">AUTORIZARE ÎNREGISTRATĂ</div><div className="mt-2 text-3xl font-bold">500 lei</div><p className="mt-2 text-sm leading-6 text-[#c2cbc5]">Suma rămâne rezervată pe cardul clientului pe durata lucrării după confirmarea autorizării de către procesator.</p><p className="mt-3 text-sm leading-6 text-white">După apăsarea butonului „Finalizează lucrarea”, platforma inițiază capturarea. Plata este marcată capturată numai după răspunsul reușit al procesatorului.</p><p className="mt-3 text-xs leading-5 text-[#9ca8a0]">Timpul efectiv până când fondurile apar în contul bancar al firmei poate depinde de procesatorul de plăți și de bancă.</p></div>
    <ol className="mt-4 grid gap-2 text-xs sm:grid-cols-3">{steps.map(([number,title,copy])=><li key={title} className="rounded-xl border border-[#d8d7d0] bg-[#faf9f5] p-3"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#e4f0e8] font-bold text-[#14663a]">{number}</span><b className="mt-2 block text-[10px] leading-4 text-[#14663a]">{title}</b><p className="mt-1.5 leading-4 text-[#5c6660]">{copy}</p></li>)}</ol>
  </article>;
}
