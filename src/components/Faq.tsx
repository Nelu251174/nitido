"use client";

import { useState } from "react";

const FAQ_ITEMS: { question: string; answer: string }[] = [
  {
    question: "Cum se calculează prețul lucrării?",
    answer:
      "Pe baza tipului de spațiu și a suprafeței, după o grilă fixă de prețuri — vezi prețul exact înainte să confirmi postarea, fără licitație și fără negociere ulterioară.",
  },
  {
    question: "Ce se întâmplă dacă firma acceptată nu se prezintă?",
    answer:
      "Platforma detectează automat lipsa confirmării de sosire la ora programată. Rezervarea de pe cardul tău se anulează — nu se reține nicio sumă — și poți repostă lucrarea către alte firme cu un singur click.",
  },
  {
    question: "Când sunt debitat efectiv?",
    answer:
      "Niciodată la acceptare. Suma e doar rezervată (autorizată) pe card. Se debitează abia după ce lucrarea e confirmată ca finalizată.",
  },
  {
    question: "Cum mă înregistrez ca firmă de curățenie?",
    answer:
      "Creezi cont din pagina de înregistrare, alegi „Sunt firmă”, completezi CUI și zona de acoperire. De acolo primești alerte pentru lucrări noi din zona ta.",
  },
  {
    question: "Cât costă înregistrarea pentru firme?",
    answer: "Nimic. Înregistrarea e gratuită — firma câștigă doar din lucrările pe care le acceptă.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="max-w-3xl mx-auto divide-y divide-line border-t border-b border-line">
      {FAQ_ITEMS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={i}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between py-5 text-left"
            >
              <span className="font-display font-bold text-ink text-[15px] pr-6">
                {item.question}
              </span>
              <span
                className={`flex-shrink-0 w-6 h-6 rounded-full border border-line flex items-center justify-center text-muted transition-transform ${
                  isOpen ? "rotate-45" : ""
                }`}
              >
                +
              </span>
            </button>
            {isOpen && (
              <p className="text-sm text-muted leading-relaxed pb-5 pr-10">{item.answer}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
