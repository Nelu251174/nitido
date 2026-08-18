"use client";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Logo, Card, Field, inputClass, Button, StatusTrack, StarRating } from "@/components/ui";
import {
  calcGrossPrice,
  SLOT_HOURS,
  isSlotValid,
  nextValidAsapSlot,
  formatInterval,
  calcBlockedMinutes,
  SpaceType,
} from "@/lib/pricing";
import { JobRow } from "@/lib/types";
import { useCurrentUser } from "@/lib/useCurrentUser";
import { applyCredit } from "@/lib/referral";

const SPACE_LABELS: Record<SpaceType, string> = {
  apartament: "Apartament",
  casa: "Casă",
  birou: "Birou",
  altul: "Altul (sală jocuri etc.)",
};

const DAY_NAMES = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"];

interface UploadedPhoto {
  id: string;
  url: string;
}

export default function ClientPage() {
  const router = useRouter();
  const { user, loading } = useCurrentUser();

  const [street, setStreet] = useState("Str. Exemplu 12");
  const [postalCode, setPostalCode] = useState("900123");
  const [city, setCity] = useState("Constanța");
  const [floor, setFloor] = useState("3");
  const [sqm, setSqm] = useState(75);
  const [spaceType, setSpaceType] = useState<SpaceType>("apartament");
  const [whenType, setWhenType] = useState<"asap" | "scheduled">("asap");
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date());
  const [scheduledHour, setScheduledHour] = useState<number | null>(null);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [uploading, setUploading] = useState(false);

  const [job, setJob] = useState<JobRow | null>(null);
  const [firmName, setFirmName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || user.role !== "client") router.replace("/login");
  }, [loading, user, router]);

  async function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, 5 - photos.length);
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/uploads", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          setPhotos((prev) => [...prev, { id: data.id, url: data.url }]);
        }
      }
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const price = useMemo(() => {
    try {
      return calcGrossPrice(spaceType, sqm);
    } catch {
      return 0;
    }
  }, [spaceType, sqm]);

  const creditBalance = user?.credit_balance ?? 0;
  const { finalPrice, creditUsed } = applyCredit(price, creditBalance);

  const asapSlot = useMemo(() => nextValidAsapSlot(), []);

  const next14Days = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() + i);
      return d;
    });
  }, []);

  async function postJob() {
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = {
        street,
        postalCode,
        city,
        floor,
        sqm,
        spaceType,
        whenType,
        photoIds: photos.map((p) => p.id),
      };
      if (whenType === "scheduled") {
        if (scheduledHour === null) {
          setError("Alege un slot orar.");
          setSubmitting(false);
          return;
        }
        body.scheduledDate = scheduledDate.toISOString();
        body.scheduledHour = scheduledHour;
      }
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Eroare la postare");
      setJob(data.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Eroare necunoscută");
    } finally {
      setSubmitting(false);
    }
  }

  const poll = useCallback(async () => {
    if (!job) return;
    const res = await fetch(`/api/jobs/${job.id}`);
    if (!res.ok) return;
    const data = await res.json();
    setJob(data.job);
    setFirmName(data.firmName);
  }, [job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!job) return;
    if (["waiting", "accepted", "arrived"].includes(job.status)) {
      const t = setInterval(poll, 2000);
      return () => clearInterval(t);
    }
  }, [job?.status, job?.id, poll]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitRating(stars: number) {
    if (!job) return;
    const res = await fetch(`/api/jobs/${job.id}/rating`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stars }),
    });
    if (res.ok) setRatingDone(true);
  }

  function resetToForm() {
    setJob(null);
    setFirmName(null);
    setRatingDone(false);
    setPhotos([]);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  if (loading || !user || user.role !== "client") {
    return (
      <div className="min-h-screen bg-mist flex items-center justify-center text-muted text-sm">
        Se încarcă...
      </div>
    );
  }

  return (
    <div className="min-h-screen mesh-light">
      <header className="glass sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted">
              Salut, <b className="text-ink">{user.name}</b>
            </span>
            <Link href="/" className="text-sm font-display font-bold text-muted hover:text-ink">
              Vezi site-ul public →
            </Link>
            <button onClick={logout} className="text-sm text-muted hover:text-coral">
              Ieși din cont
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-10">
        {!job && user?.referral_code && (
          <ReferralCard code={user.referral_code} creditBalance={creditBalance} />
        )}
        {!job && (
          <Card>
            <h1 className="font-display font-extrabold text-xl text-ink mb-1">
              Postează o lucrare
            </h1>
            <p className="text-sm text-muted mb-5 leading-relaxed">
              Completează detaliile — vezi prețul instant, apoi firmele din zonă primesc alerta.
            </p>

            <Field label="Stradă și număr">
              <input className={inputClass} value={street} onChange={(e) => setStreet(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cod poștal">
                <input className={inputClass} value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
              </Field>
              <Field label="Oraș">
                <input className={inputClass} value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Etaj">
                <input className={inputClass} value={floor} onChange={(e) => setFloor(e.target.value)} />
              </Field>
              <Field label="Suprafață (mp)">
                <input
                  type="number"
                  className={inputClass}
                  value={sqm}
                  onChange={(e) => setSqm(Number(e.target.value) || 0)}
                />
              </Field>
            </div>
            <Field label="Tip spațiu">
              <select
                className={inputClass}
                value={spaceType}
                onChange={(e) => setSpaceType(e.target.value as SpaceType)}
              >
                {Object.entries(SPACE_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>

            <span className="block text-[10.5px] uppercase tracking-wide text-muted font-semibold mb-1">
              Când?
            </span>
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setWhenType("asap")}
                className={`flex-1 py-2.5 rounded-lg border font-display font-bold text-xs ${
                  whenType === "asap" ? "border-aqua bg-aqua/10 text-ink" : "border-line text-muted"
                }`}
              >
                Cât mai curând
              </button>
              <button
                type="button"
                onClick={() => setWhenType("scheduled")}
                className={`flex-1 py-2.5 rounded-lg border font-display font-bold text-xs ${
                  whenType === "scheduled" ? "border-aqua bg-aqua/10 text-ink" : "border-line text-muted"
                }`}
              >
                Aleg data
              </button>
            </div>

            {whenType === "asap" && asapSlot && (
              <div className="text-xs text-muted bg-mist rounded-lg px-3 py-2.5 mb-3">
                Cel mai apropiat slot disponibil:{" "}
                <b className="text-ink">
                  {asapSlot.date.toDateString() === new Date().toDateString() ? "azi" : "mâine"},{" "}
                  {String(asapSlot.hour).padStart(2, "0")}:00
                </b>
              </div>
            )}

            {whenType === "scheduled" && (
              <div className="mb-3">
                <div className="flex gap-1.5 overflow-x-auto pb-1.5 mb-2">
                  {next14Days.map((d, i) => (
                    <button
                      type="button"
                      key={i}
                      onClick={() => {
                        setScheduledDate(d);
                        setScheduledHour(null);
                      }}
                      className={`flex-shrink-0 w-12 text-center py-2 rounded-lg border text-[11px] ${
                        d.toDateString() === scheduledDate.toDateString()
                          ? "border-aqua bg-aqua/10"
                          : "border-line"
                      }`}
                    >
                      {DAY_NAMES[d.getDay()]}
                      <div className="font-display font-bold text-sm">{d.getDate()}</div>
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {SLOT_HOURS.map((h) => {
                    const valid = isSlotValid(scheduledDate, h);
                    return (
                      <button
                        type="button"
                        key={h}
                        disabled={!valid}
                        onClick={() => setScheduledHour(h)}
                        className={`py-2 rounded-lg border text-xs ${
                          !valid
                            ? "opacity-30 line-through cursor-not-allowed border-line"
                            : scheduledHour === h
                            ? "border-aqua bg-aqua/10 font-bold"
                            : "border-line"
                        }`}
                      >
                        {String(h).padStart(2, "0")}:00
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <label className="block border border-dashed border-line rounded-lg p-4 text-center mb-2 cursor-pointer hover:border-aqua bg-white">
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                disabled={photos.length >= 5 || uploading}
                onChange={handlePhotoSelect}
              />
              <div className="text-xl mb-0.5">📷</div>
              <div className="font-display font-semibold text-xs">
                {uploading
                  ? "Se încarcă..."
                  : photos.length > 0
                  ? `${photos.length} poză(e) adăugate`
                  : "Adaugă poze (opțional)"}
              </div>
              <div className="text-[10.5px] text-muted mt-0.5">
                Firmele acceptă mai repede lucrări cu context clar
              </div>
            </label>
            {photos.length > 0 && (
              <div className="flex gap-1.5 mb-2 flex-wrap">
                {photos.map((p) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    key={p.id}
                    src={p.url}
                    alt="Poză lucrare"
                    className="w-12 h-12 rounded-lg object-cover border border-line"
                  />
                ))}
              </div>
            )}

            <div className="bg-mist border border-aqua rounded-xl p-3.5 my-4">
              <div className="flex justify-between items-center">
                <span className="text-[11.5px] text-muted">
                  {creditUsed > 0 ? "Preț (după credit)" : "Preț estimat"}
                </span>
                <span className="flex items-baseline gap-2">
                  {creditUsed > 0 && (
                    <span className="text-xs text-muted line-through">{price} lei</span>
                  )}
                  <span className="font-display font-extrabold text-xl text-aqua-deep">
                    {finalPrice} lei
                  </span>
                </span>
              </div>
              {creditUsed > 0 && (
                <p className="text-[11px] text-aqua-deep font-semibold mt-1">
                  Ai folosit {creditUsed} lei din creditul de recomandare
                </p>
              )}
            </div>

            {error && <p className="text-coral text-xs mb-3">{error}</p>}

            <Button className="w-full" onClick={postJob} disabled={submitting}>
              {submitting ? "Se postează..." : "Postează lucrarea"}
            </Button>
          </Card>
        )}

        {job && job.status === "waiting" && (
          <Card>
            <h1 className="font-display font-extrabold text-xl text-ink mb-1">Lucrare postată!</h1>
            <p className="text-sm text-muted mb-2">
              Firmele din zonă au primit alerta acum. Așteptăm acceptare.
            </p>
            {job.scheduled_at && (
              <p className="text-xs text-muted">
                Interval rezervat: {formatInterval(new Date(job.scheduled_at), calcBlockedMinutes(job.sqm))}
              </p>
            )}
            <StatusTrack
              steps={[
                { label: "Alertă trimisă către firme", done: true },
                { label: "Așteaptă acceptare...", done: false },
                { label: "Confirmată", done: false },
              ]}
            />
          </Card>
        )}

        {job && (job.status === "accepted" || job.status === "arrived") && (
          <Card>
            <h1 className="font-display font-extrabold text-xl text-ink mb-1">
              Lucrare confirmată ✅
            </h1>
            <p className="text-sm text-muted mb-2">
              Firma <b className="text-ink">{firmName ?? "..."}</b> a acceptat lucrarea ta.
            </p>
            <StatusTrack
              steps={[
                { label: "Alertă trimisă către firme", done: true },
                { label: `Acceptată de ${firmName ?? "firmă"}`, done: true },
                {
                  label: job.status === "arrived" ? "Firma a ajuns" : "Așteaptă sosirea firmei",
                  done: job.status === "arrived",
                },
              ]}
            />
          </Card>
        )}

        {job && job.status === "completed" && !ratingDone && (
          <Card>
            <h1 className="font-display font-bold text-lg text-ink text-center mb-1">
              Cum a fost curățenia?
            </h1>
            <p className="text-sm text-muted text-center mb-2">
              {firmName ?? "Firma"} a finalizat lucrarea. Lasă un rating — plata se procesează abia
              acum.
            </p>
            <RatingBlock onSubmit={submitRating} />
          </Card>
        )}

        {job && job.status === "completed" && ratingDone && (
          <Card>
            <h1 className="font-display font-bold text-lg text-ink mb-2">Mulțumim!</h1>
            <p className="text-sm text-muted mb-4">Rating-ul tău a fost înregistrat.</p>
            <Button variant="outline" className="w-full" onClick={resetToForm}>
              Postează o nouă lucrare
            </Button>
          </Card>
        )}

        {job && job.status === "no_show" && (
          <Card>
            <h1 className="font-display font-bold text-lg text-coral mb-2">
              Firma nu a confirmat prezența
            </h1>
            <p className="text-sm text-muted mb-4">
              Lucrarea a fost anulată automat. Nu s-a reținut nicio sumă — hold-ul a fost eliberat.
            </p>
            <Button className="w-full" onClick={resetToForm}>
              Repostează lucrarea
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
}

function ReferralCard({ code, creditBalance }: { code: string; creditBalance: number }) {
  const [copied, setCopied] = useState(false);

  function copyCode() {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="bg-aqua/10 border border-aqua rounded-xl p-4 mb-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-display font-bold text-sm text-ink">
            Recomandă Nitido unui prieten
          </div>
          <div className="text-[11.5px] text-muted mt-0.5">
            Amândoi primiți 20 lei credit — codul tău:{" "}
            <span className="font-mono font-bold text-ink">{code}</span>
          </div>
        </div>
        <button
          onClick={copyCode}
          className="flex-shrink-0 text-xs font-display font-bold text-aqua-deep border border-aqua rounded-lg px-3 py-2 bg-white hover:bg-aqua/10"
        >
          {copied ? "Copiat!" : "Copiază"}
        </button>
      </div>
      {creditBalance > 0 && (
        <div className="text-[11.5px] text-aqua-deep font-semibold mt-2">
          Ai {creditBalance} lei credit disponibil — se aplică automat la următoarea lucrare.
        </div>
      )}
    </div>
  );
}

function RatingBlock({ onSubmit }: { onSubmit: (stars: number) => void }) {
  const [stars, setStars] = useState(0);
  return (
    <div>
      <StarRating value={stars} onChange={setStars} />
      <Button className="w-full" disabled={stars === 0} onClick={() => onSubmit(stars)}>
        Trimite rating
      </Button>
    </div>
  );
}
