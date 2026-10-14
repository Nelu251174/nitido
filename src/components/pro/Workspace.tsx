"use client";
import {UiDate} from '@/components/UiDate';
import {UiText,UiElement,UiTemplate} from '@/components/UiText';
/* API commands remain authoritative. Flexible rows render the versioned Pro read models. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import PropertyChecklists from "./PropertyChecklists";
import PortfolioDashboard from "./PortfolioDashboard";
import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { SERVICES, STATUS, money } from "@/lib/pro/shared";
type Row = Record<string, any>;
type Field = {
  name: string;
  label: string;
  type?: string;
  options?: [string, string][];
  value?: string | number;
  optional?: boolean;
};
type Run = (path: string, b: Row) => Promise<Row>;
const field = (
  name: string,
  label: string,
  type = "text",
  options?: [string, string][],
): Field => ({ name, label, type, options });
const nav = [
  ["dashboard", "Dashboard"],
  ["proprietati", "Proprietăți"],
  ["calendar", "Calendar"],
  ["lucrari", "Lucrări"],
  ["tichete", "Mentenanță"],
  ["aprobari", "Aprobări"],
  ["rapoarte", "Rapoarte"],
  ["echipa", "Echipă"],
  ["setari", "Setări"],
  ["partener", "Portal partener"],
  ["operator", "Operator"],
];
function Form({
  title,
  fields,
  run,
  onSubmit,
}: {
  title: string;
  fields: Field[];
  run: Run;
  onSubmit: (b: Row, run: Run) => Promise<unknown>;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [ok, setOk] = useState("");
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setOk("");
    const data: Row = Object.fromEntries(new FormData(form));
    for (const f of fields) {
      if (f.type === "number")
        data[f.name] =
          f.optional && data[f.name] === "" ? null : Number(data[f.name]);
      if (f.type === "datetime-local" && data[f.name])
        data[f.name] = new Date(data[f.name]).toISOString();
    }
    try {
      const result = (await onSubmit(data, run)) as Row;
      setOk(
        result?.invite_path
          ? `Invitație: ${window.location.origin}${result.invite_path}`
          : "Operațiunea a fost confirmată.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operațiune neconfirmată.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <details className="pro-card mt-4">
      <summary>{title}</summary>
      <form onSubmit={submit}>
        <div className="pro-form-grid">
          {fields.map((f) => (
            <label className="pro-field" key={f.name}>
              {f.label}
              {f.options ? (
                <select
                  name={f.name}
                  defaultValue={f.value}
                  required={!f.optional}
                >
                  <option value=""><UiText text={"Selectează"}/></option>
                  {f.options.map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              ) : f.type === "textarea" ? (
                <textarea
                  name={f.name}
                  defaultValue={f.value}
                  required={!f.optional}
                  maxLength={2000}
                />
              ) : (
                <input
                  name={f.name}
                  type={f.type ?? "text"}
                  required={!f.optional}
                  defaultValue={f.value}
                  min={f.type === "number" ? 0 : undefined}
                  maxLength={f.type === "text" ? 250 : undefined}
                />
              )}
            </label>
          ))}
        </div>
        {error && (
          <p role="alert" className="pro-error">
            {<UiText text={error}/>}
          </p>
        )}
        {ok && (
          <p role="status" className="pro-success break-all">
            {ok}
          </p>
        )}
        <div className="pro-actions">
          <button className="v2-btn v2-btn-primary" disabled={busy}>
            {busy ? <UiText text={"Se salvează…"}/> : title}
          </button>
        </div>
      </form>
    </details>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div className="pro-empty">{children}</div>;
}
function Badge({ status }: { status: string }) {
  return <span className="pro-status"><UiText text={STATUS[status] ?? status}/></span>;
}
function date(v: string) {
  return <UiDate value={new Date(v)} options={{timeZone:undefined,dateStyle:'short',timeStyle:'short'}}/>;
}

const serviceFields = [
  field("service", "Serviciu", "select", Object.entries(SERVICES)),
  field("starts_at", "Început", "datetime-local"),
  field("ends_at", "Sfârșit", "datetime-local"),
  field("estimate", "Estimare brută, în bani (100 bani = 1 leu)", "number"),
];
export default function Workspace({ path }: { path: string[] }) {
  const section = path[0] ?? "dashboard",
    detailId = path[1];
  const [context, setContext] = useState<Row | null>(null),
    [org, setOrg] = useState(""),
    [data, setData] = useState<Row>({}),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true),
    [tick, setTick] = useState(0);
  const retry = useRef(new Map<string, string>());
  const [inviteToken, setInviteToken] = useState("");
  const [range, setRange] = useState({
    from: "",
    to: "",
    property: "",
    category: "",
    property_page: "0",
  });
  const [secret, setSecret] = useState("");
  const internal = !!context?.internal_role;
  const canManage = !internal || !!context?.internal_permissions?.manage;
  const canOperate = !internal || !!context?.internal_permissions?.operations;
  const canFinance = !internal || !!context?.internal_permissions?.finance;
  const canSuper = !internal || !!context?.internal_permissions?.super_admin;
  async function read(url: string) {
    const r = await fetch("/api/pro/" + url, { cache: "no-store" }),
      d = await r.json();
    if (!r.ok) throw new Error(d.error);
    return d;
  }
  useEffect(() => {
    let live = true;
    read("context")
      .then((c) => {
        if (live) {
          setContext(c);
          setOrg(c.organizations[0]?.id ?? "");
          const token = new URLSearchParams(window.location.hash.slice(1)).get(
            "invite",
          );
          if (token) {
            setInviteToken(token);
            window.history.replaceState(null, "", window.location.pathname);
          }
        }
      })
      .catch((e) => {
        if (live) {
          setError(e.message);
          setLoading(false);
        }
      });
    return () => {
      live = false;
    };
  }, []);
  useEffect(() => {
    if (!context) return;
    let live = true;
    const q =
      "?organization_id=" +
      encodeURIComponent(org) +
      "&" +
      new URLSearchParams(range);
    (async () => {
      const next: Row = {};
      next.notifications = await read("notifications");
      if (section === "operator") {
        if (!context.admin)
          throw new Error(
            "Consola de activare este rezervată administratorului NITIDO.",
          );
        if (!context.internal_role || context.internal_permissions?.operations) next.leads = await read("leads");
        if (org && (!context.internal_role || context.internal_permissions?.operations)) next.partners = await read("partners" + q);
      }
      if (section === "partener") next.rows = await read("partner");
      else if (org) {
        next.properties = await read("properties" + q);
        if (detailId && section === "lucrari") {
          next.item = await read("work-orders/" + detailId);
          if (next.item.permissions.operator)
            next.partners = await read("partners" + q);
        } else if (detailId && section === "tichete")
          next.item = await read("tickets/" + detailId);
        else if (detailId && section === "proprietati") {
          next.item = await read("properties/" + detailId);
          next.rows = (await read("work-orders" + q)).filter(
            (w: Row) => w.property_id === detailId,
          );
        } else if (section === "dashboard") {
          next.summary = await read("dashboard" + q);
          next.rows = next.summary.attentionWork;
        } else if (["lucrari", "calendar"].includes(section)) {
          next.rows = await read("work-orders" + q);
          if (section === "calendar" && (!context.internal_role || context.internal_permissions?.manage)) next.rules = await read("recurring" + q);
        } else if (section === "tichete") next.rows = await read("tickets" + q);
        else if (section === "aprobari")
          next.rows = await read("approvals" + q);
        else if (section === "rapoarte") next.rows = await read("costs" + q);
        else if (section === "echipa") {
          next.rows = await read("team" + q);
          next.invites = await read("invites" + q);
        }
      } else if (detailId && section === "lucrari")
        next.item = await read("work-orders/" + detailId);
      if (live) {
        setError("");
        setSecret("");
        setData(next);
      }
    })()
      .catch((e) => {
        if (live) setError(e.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [context, org, section, detailId, tick, range]);
  const run: Run = async (url, b) => {
    const payload = JSON.stringify(b),
      signature = url + payload;
    const key = retry.current.get(signature) ?? crypto.randomUUID();
    retry.current.set(signature, key);
    const r = await fetch("/api/pro/" + url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "idempotency-key": key },
        body: payload,
      }),
      d = await r.json();
    if (!r.ok) throw new Error(d.error);
    retry.current.delete(signature);
    setTick((v) => v + 1);
    if (
      url.startsWith("organizations") ||
      url.startsWith("activate") ||
      url === "invites/accept"
    )
      setContext(await read("context"));
    return d;
  };
  const props: [string, string][] = (data.properties ?? []).map((p: Row) => [
    p.id,
    p.name,
  ]);
  const propField = field("property_id", "Proprietate", "select", props);
  const organization = context?.organizations.find((o: Row) => o.id === org);
  const w = data.item;
  const rows: Row[] = data.rows ?? [];
  const workList = (items: Row[]) =>
    items.length ? (
      <div className="pro-list">
        {items.map((r) => (
          <Link className="pro-row" href={"/pro/lucrari/" + r.id} key={r.id}>
            <div>
              <strong>{r.title}</strong>
              <small>
                {r.property?.name ?? ""} · {date(r.starts_at)}
              </small>
            </div>
            <Badge status={r.status} />
          </Link>
        ))}
      </div>
    ) : (
      <Empty><UiText text={"Pasul următor: programează o lucrare sau configurează o regulă recurentă."}/></Empty>
    );
  return (
    <div className="pro-app">
      <header className="pro-row rounded-none">
        <Link href="/" className="font-bold text-xl"><UiText text={"NITIDO"}/><span className="text-[var(--nitido-brand)]"><UiText text={".RO"}/></span>
        </Link>
        <Link href="/nitido-pro" className="font-semibold"><UiText text={"NITIDO Pro"}/></Link>
        <Link href="/client" className="text-sm underline"><UiText text={"Contul NITIDO"}/></Link>
      </header>
      <div className="pro-shell">
        <UiElement as="nav" className="pro-sidebar" aria-label="Navigație Pro">
          {nav
            .filter(([k]) => {
              if (k === "operator") return context?.admin && (!internal || canOperate || canManage || canSuper);
              if (!internal) return true;
              if (["echipa", "setari"].includes(k)) return canSuper;
              if (k === "rapoarte") return !!context?.internal_permissions?.reports;
              if (k === "calendar") return canManage;
              if (k === "aprobari" || k === "partener") return false;
              return true;
            })
            .map(([k, l]) => (
              <Link
                aria-current={section === k ? "page" : undefined}
                href={"/pro/" + k}
                key={k}
              >
                {l}
              </Link>
            ))}
        </UiElement>
        <main className="pro-content">
          <div className="pro-topline">
            <div>
              <p className="pro-eyebrow"><UiText text={"Operațiuni controlate"}/></p>
              <h1>{nav.find(([k]) => k === section)?.[1] ?? <UiText text={"NITIDO Pro"}/>}</h1>
              <p className="pro-muted text-sm">
                {organization?.name ?? <UiText text={"Acces pentru portofolii activate"}/>}
              </p>
            </div>
            {!!context?.organizations.length && (
              <label className="pro-field"><UiText text={"Organizație"}/><select
                  value={org}
                  onChange={(e) => {
                    setData({});
                    setSecret("");
                    setLoading(true);
                    setOrg(e.target.value);
                  }}
                >
                  {context.organizations.map((o: Row) => (
                    <option key={o.id} value={o.id}>
                      {o.name}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
          {error && (
            <div role="alert" className="pro-error">
              {<UiText text={error}/>}
              {!context && (
                <p className="mt-3">
                  <Link href="/login?role=client" className="underline mr-4"><UiText text={"Login client"}/></Link>
                  <Link href="/login?role=firma" className="underline mr-4"><UiText text={"Login firmă"}/></Link>
                  <Link href="/admin/login" className="underline"><UiText text={"Admin NITIDO"}/></Link>
                </p>
              )}
            </div>
          )}
          {loading && (
            <p role="status" className="pro-empty"><UiText text={"Se încarcă datele portofoliului…"}/></p>
          )}
          {!loading && context && (
            <>
              {!org && !context.partners.length && section !== "operator" && (
                <Empty><UiText text={"Contul tău nu are încă acces la un portofoliu Pro. Activarea se face după evaluare."}/>{" "}
                  <Link className="underline" href="/nitido-pro/aplica"><UiText text={"Solicită evaluarea"}/></Link>
                  .
                </Empty>
              )}
              {section === "dashboard" && org && (
                <>
                  {data.summary && <PortfolioDashboard report={data.summary} filters={range} properties={props} onChange={next => setRange({ ...next, property_page: next.property_page ?? "0" })} />}
                  <h2><UiText text={"Lucrări de urmărit"}/></h2>
                  {workList(
                    rows
                      .filter(
                        (x) => !["completed", "cancelled"].includes(x.status),
                      )
                      .slice(0, 8),
                  )}
                  <h2><UiText text={"Notificări"}/></h2>
                  {data.notifications?.length ? (
                    <div className="pro-list">
                      {data.notifications.slice(0, 12).map((n: Row) => (
                        <Link key={n.id} className="pro-row" href={n.href}>
                          {n.title}
                          <small>{date(n.created_at)}</small>
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <Empty><UiText text={"Nu există notificări noi."}/></Empty>
                  )}
                </>
              )}
              {section === "proprietati" && org && !detailId && (
                <>
                  <div className="pro-list">
                    {(data.properties ?? []).map((r: Row) => (
                      <Link
                        className="pro-row"
                        key={r.id}
                        href={"/pro/proprietati/" + r.id}
                      >
                        <div>
                          <strong>{r.name}</strong>
                          <small>{r.city}</small>
                        </div>
                        <Badge status={r.status} />
                      </Link>
                    ))}
                  </div>
                  {!data.properties?.length && (
                    <Empty><UiText text={"Nu există proprietăți active. Adaugă prima proprietate pentru a configura operațiunile recurente."}/></Empty>
                  )}
                  {canManage && <Form
                    title="Adaugă proprietate"
                    fields={[
                      field("name", "Nume intern"),
                      field("city", "Oraș"),
                      field("address", "Adresă completă"),
                      { ...field("postal_code", "Cod poștal"), optional: true },
                      { ...field("floor", "Etaj"), optional: true },
                    ]}
                    run={run}
                    onSubmit={(b, r) =>
                      r("properties", { ...b, organization_id: org })
                    }
                  />}
                </>
              )}
              {section === "proprietati" && w && (
                <>
                  <div className="pro-card">
                    <h2>{w.name}</h2>
                    <p>{w.city}</p>
                    {w.address && (
                      <p>
                        {w.address} · {w.postal_code} · {w.floor}
                      </p>
                    )}
                  </div>
                  {canManage && <Form
                    title="Editează proprietatea"
                    fields={[
                      { ...field("name", "Nume"), value: w.name },
                      { ...field("address", "Adresă"), value: w.address },
                      {
                        ...field("postal_code", "Cod poștal"),
                        value: w.postal_code,
                        optional: true,
                      },
                      {
                        ...field("floor", "Etaj"),
                        value: w.floor,
                        optional: true,
                      },
                      {
                        ...field(
                          "instructions",
                          "Instrucțiuni fără coduri",
                          "textarea",
                        ),
                        value: w.instructions,
                        optional: true,
                      },
                      {
                        ...field(
                          "threshold",
                          "Prag propriu în bani; gol = moștenire",
                          "number",
                        ),
                        value: w.threshold ?? "",
                        optional: true,
                      },
                      {
                        ...field("status", "Stare", "select", [
                          ["active", "Activă"],
                          ["inactive", "Inactivă"],
                          ["archived", "Arhivată"],
                        ]),
                        value: w.status,
                      },
                    ]}
                    run={run}
                    onSubmit={(b, r) => r(`properties/${w.id}/update`, b)}
                  />}
                  {canManage && w.checklist_configuration && <PropertyChecklists key={w.id} propertyId={w.id} configuration={w.checklist_configuration} run={run} />}
                  <h2><UiText text={"Istoric lucrări"}/></h2>
                  {workList(rows)}
                  {!internal && <Form
                    title="Salvează codul de acces"
                    fields={[field("secret", "Cod acces", "password")]}
                    run={run}
                    onSubmit={(b, r) => r(`properties/${w.id}/credential`, b)}
                  />}
                </>
              )}
              {["lucrari", "calendar"].includes(section) &&
                org &&
                !detailId && (
                  <>
                    {workList(rows)}
                    {canManage && <Form
                      title="Programează lucrare"
                      fields={[
                        propField,
                        field("title", "Titlu"),
                        ...serviceFields,
                      ]}
                      run={run}
                      onSubmit={(b, r) => r("work-orders", b)}
                    />}
                    {section === "calendar" && canManage && (
                      <>
                        <Form
                          title="Adaugă regulă recurentă"
                          fields={[
                            propField,
                            field("title", "Titlu"),
                            field(
                              "service",
                              "Serviciu",
                              "select",
                              Object.entries(SERVICES).filter(
                                ([s]) => s !== "cleaning_turnover",
                              ),
                            ),
                            field("frequency", "Frecvență", "select", [
                              ["daily", "Zilnic"],
                              ["weekly", "Săptămânal"],
                              ["biweekly", "La două săptămâni"],
                              ["monthly", "Lunar"],
                            ]),
                            field("start_date", "Prima zi", "date"),
                            { ...field("end_date", "Ultima zi (opțional)", "date"), optional: true },
                            field("hour", "Ora locală, 0–23", "number"),
                            field("duration", "Durată, minute", "number"),
                            field("estimate", "Cost estimat, bani", "number"),
                          ]}
                          run={run}
                          onSubmit={(b, r) => r("recurring", b)}
                        />
                        <h2><UiText text={"Reguli recurente"}/></h2>
                        {(data.rules ?? []).map((r: Row) => (
                          <div className="pro-row mb-3" key={r.id}>
                            <div>
                              {r.title}
                              <small>
                                {<UiText text={{ daily: "Zilnic", weekly: "Săptămânal", biweekly: "La două săptămâni", monthly: "Lunar" }[r.frequency as string]}/>}<UiText text={" · Următoarea apariție: "}/>{r.next_date} ·{" "}
                                {r.active ? <UiText text={"Activă"}/> : <UiText text={"În pauză"}/>}
                                {r.end_date && <UiTemplate text={" · Ultima zi: {p0}"} values={[r.end_date]}/>}
                              </small>
                            </div>
                            <button
                              className="v2-btn v2-btn-secondary"
                              onClick={() =>
                                run("recurring/" + r.id, {
                                  active: !r.active,
                                }).catch((e) => setError(e.message))
                              }
                            >
                              {r.active ? <UiText text={"Pauză"}/> : <UiText text={"Reia"}/>}
                            </button>
                            <Form
                              title="Omite o apariție viitoare"
                              fields={[
                                field("day", "Data neprogramată încă", "date"),
                              ]}
                              run={run}
                              onSubmit={(b, send) =>
                                send("recurring/" + r.id + "/skip", b)
                              }
                            />
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              {section === "partener" && workList(rows)}
              {section === "lucrari" && w && (
                <>
                  <div className="pro-card">
                    <div className="pro-row border-0 p-0">
                      <h2>{w.title}</h2>
                      <Badge status={w.status} />
                    </div>
                    <p>
                      {w.property.name} · {w.property.city}
                    </p>
                    <p className="pro-muted">
                      {date(w.starts_at)} — {date(w.ends_at)}
                    </p>
                    {w.property.address && (
                      <p className="mt-3">{w.property.address}</p>
                    )}
                    {w.property.instructions && (
                      <p>{w.property.instructions}</p>
                    )}
                    {w.estimate !== undefined && (
                      <p className="mt-4"><UiText text={"Estimat: "}/><strong>{money(w.estimate)}</strong> ·{" "}
                        <Badge status={w.financial_status} />
                        {w.final_cost !== null &&
                          w.final_cost !== undefined && (
                            <><UiText text={" · Final: "}/>{money(w.final_cost)}</>
                          )}
                      </p>
                    )}
                    {w.review_note && (
                      <p className="pro-success">{w.review_note}</p>
                    )}
                    {(w.permissions.partner || (internal && canOperate && ["accepted", "in_progress", "submitted_for_review", "rework_requested"].includes(w.status))) && (
                      <div className="pro-actions">
                        <button
                          className="v2-btn v2-btn-secondary"
                          onClick={() =>
                            read(`work-orders/${w.id}/credential`)
                              .then((d) => setSecret(d.secret))
                              .catch((e) => setError(e.message))
                          }
                        ><UiText text={"Arată codul autorizat"}/></button>
                        {secret && <p>{secret}</p>}
                      </div>
                    )}
                  </div>
                  {w.permissions.offer && (
                    <div className="pro-actions">
                      {["accept", "decline"].map((a) => (
                        <button
                          key={a}
                          className="v2-btn v2-btn-primary"
                          onClick={() =>
                            run(`work-orders/${w.id}/${a}`, {
                              revision: w.revision,
                            }).catch((e) => setError(e.message))
                          }
                        >
                          {a === "accept"
                            ? <UiText text={"Acceptă lucrarea"}/>
                            : <UiText text={"Refuză oferta"}/>}
                        </button>
                      ))}
                    </div>
                  )}
                  {w.permissions.partner &&
                    ["accepted", "rework_requested"].includes(w.status) && (
                      <button
                        className="v2-btn v2-btn-primary mt-4"
                        onClick={() =>
                          run(`work-orders/${w.id}/start`, {
                            revision: w.revision,
                          }).catch((e) => setError(e.message))
                        }
                      ><UiText text={"Începe lucrarea"}/></button>
                    )}
                  {w.checklist_json !== undefined && w.answers_json !== undefined && <div className="pro-card mt-4">
                    <h2><UiText text={"Checklist"}/></h2>
                    <Checklist key={w.revision} work={w} run={run} />
                  </div>}
                  {canOperate && <div className="pro-card mt-4">
                    <h2><UiText text={"Dovezi foto"}/></h2><p><UiText text={"Minimum la sosire: "}/>{w.photoRules?.arrivalMin??0}<UiText text={"; minimum la finalizare: "}/>{w.photoRules?.completionMin??1}<UiText text={". La remediere sunt necesare fotografii noi, după redeschiderea execuției."}/></p>
                    <div className="pro-photos">
                      {w.media?.map((m: Row) => (
                        <a
                          key={m.id}
                          href={"/api/pro/media/" + m.id}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <Image
                            unoptimized
                            width={130}
                            height={100}
                            src={"/api/pro/media/" + m.id}
                            alt={"Dovadă " + m.category}
                          />
                        </a>
                      ))}
                    </div>
                    {!w.media?.length && (
                      <p className="pro-muted"><UiText text={"Nu există fotografii disponibile."}/></p>
                    )}
                    {w.permissions.partner && ["accepted", "rework_requested", "in_progress"].includes(w.status) && (
                      <Upload
                        beforeOnly={w.status !== "in_progress"}
                        entity="work_order_id"
                        id={w.id}
                        onDone={() => setTick((v) => v + 1)}
                      />
                    )}
                  </div>}
                  {w.permissions.partner && w.status === "in_progress" && (
                    <Form
                      title="Trimite spre verificare"
                      fields={[
                        {
                          ...field("final_cost", "Cost final, bani", "number"),
                          value: w.estimate,
                        },
                      ]}
                      run={run}
                      onSubmit={(b, r) =>
                        r(`work-orders/${w.id}/submit`, {
                          ...b,
                          revision: w.revision,
                        })
                      }
                    />
                  )}
                  {(w.permissions.manage || (internal && canOperate)) && w.status === "scheduled" && (
                    <Form
                      title="Reprogramează lucrarea"
                      fields={[
                        field("starts_at", "Început nou", "datetime-local"),
                        field("ends_at", "Sfârșit nou", "datetime-local"),
                      ]}
                      run={run}
                      onSubmit={(b, r) =>
                        r(`work-orders/${w.id}/reschedule`, {
                          ...b,
                          revision: w.revision,
                        })
                      }
                    />
                  )}
                  {w.permissions.manage &&
                    [
                      "scheduled",
                      "accepted",
                      "in_progress",
                      "rework_requested",
                    ].includes(w.status) && (
                      <Form
                        title="Propune deviz nou"
                        fields={[
                          field("amount", "Suma brută, bani", "number"),
                          field("note", "Motiv", "textarea"),
                        ]}
                        run={run}
                        onSubmit={(b, r) =>
                          r(`work-orders/${w.id}/quote`, {
                            ...b,
                            revision: w.revision,
                          })
                        }
                      />
                    )}
                  {w.permissions.operator && w.status === "scheduled" && (
                    <Form
                      title="Oferă lucrarea"
                      fields={[
                        field(
                          "partner_id",
                          "Partener",
                          "select",
                          (data.partners ?? [])
                            .filter((x: Row) => x.status === "active")
                            .map((x: Row) => [x.id, x.name]),
                        ),
                      ]}
                      run={run}
                      onSubmit={(b, r) =>
                        r(`work-orders/${w.id}/offer`, {
                          ...b,
                          revision: w.revision,
                        })
                      }
                    />
                  )}
                  {w.permissions.operator &&
                    w.status === "submitted_for_review" && (
                      <>
                        {canManage && <Form
                          title="Confirmă finalizarea"
                          fields={[
                            field("note", "Observații verificare", "textarea"),
                          ]}
                          run={run}
                          onSubmit={(b, r) =>
                            r(`work-orders/${w.id}/complete`, {
                              ...b,
                              revision: w.revision,
                            })
                          }
                        />}
                        <Form
                          title="Solicită remediere"
                          fields={[
                            field(
                              "note",
                              "Neconformități și termen",
                              "textarea",
                            ),
                            field(
                              "starts_at",
                              "Început remediere",
                              "datetime-local",
                            ),
                            field(
                              "ends_at",
                              "Sfârșit remediere",
                              "datetime-local",
                            ),
                          ]}
                          run={run}
                          onSubmit={(b, r) =>
                            r(`work-orders/${w.id}/rework`, {
                              ...b,
                              revision: w.revision,
                            })
                          }
                        />
                      </>
                    )}
                  {w.permissions.approve &&
                    (w.approvals ?? [])
                      .filter((a: Row) => a.decision === "pending")
                      .map((a: Row) => (
                        <Form
                          key={a.id}
                          title={`Decide devizul · ${money(a.amount)}`}
                          fields={[
                            field("decision", "Decizie", "select", [
                              ["approved", "Aprobă"],
                              ["rejected", "Respinge"],
                              ["changes_requested", "Cere detalii"],
                            ]),
                            {
                              ...field(
                                "amount",
                                "Confirmă suma exactă, bani",
                                "number",
                              ),
                              value: a.amount,
                            },
                            field("note", "Comentariu", "textarea"),
                          ]}
                          run={run}
                          onSubmit={(b, r) => r("approvals/" + a.id, b)}
                        />
                      ))}
                  {(w.permissions.manage || (internal && canOperate)) &&
                    !["completed", "cancelled"].includes(w.status) && (
                      <Form
                        title="Anulează lucrarea"
                        fields={[field("note", "Motiv anulare", "textarea")]}
                        run={run}
                        onSubmit={(b, r) =>
                          r(`work-orders/${w.id}/cancel`, {
                            ...b,
                            revision: w.revision,
                          })
                        }
                      />
                    )}
                  <h2><UiText text={"Istoricul lucrării"}/></h2>
                  <ol className="pro-timeline">
                    {w.audit?.map((a: Row, i: number) => (
                      <li key={i}>
                        {a.action}
                        <time>{date(a.created_at)}</time>
                      </li>
                    ))}
                  </ol>
                </>
              )}
              {section === "tichete" && org && !detailId && (
                <>
                  <div className="pro-list">
                    {rows.map((t) => (
                      <Link
                        href={"/pro/tichete/" + t.id}
                        key={t.id}
                        className="pro-row"
                      >
                        <div>
                          {t.title}
                          <small>{t.priority}</small>
                        </div>
                        <Badge status={t.status} />
                      </Link>
                    ))}
                  </div>
                  {!rows.length && (
                    <Empty><UiText text={"Nu există tichete deschise. Problemele raportate vor apărea aici."}/></Empty>
                  )}
                  {canOperate && <Form
                    title="Deschide tichet"
                    fields={[
                      propField,
                      field("title", "Titlu"),
                      field("description", "Descriere", "textarea"),
                      field("priority", "Prioritate", "select", [
                        ["normal", "Normal"],
                        ["urgent", "Urgent"],
                        ["critical", "Critic"],
                      ]),
                    ]}
                    run={run}
                    onSubmit={(b, r) => r("tickets", b)}
                  />}
                </>
              )}
              {section === "tichete" && w && (
                <>
                  <div className="pro-card">
                    <h2>{w.title}</h2>
                    <Badge status={w.status} />
                    <p className="mt-4">{w.description}</p>
                    {w.work_order_id && (
                      <Link
                        className="underline block mt-4"
                        href={"/pro/lucrari/" + w.work_order_id}
                      ><UiText text={"Deschide lucrarea și devizul asociat"}/></Link>
                    )}
                    {canOperate && <Upload
                      entity="ticket_id"
                      id={w.id}
                      onDone={() => setTick((v) => v + 1)}
                    />}
                  </div>
                  {canOperate && <Form
                    title="Actualizează tichetul"
                    fields={[
                      field("status", "Status", "select", [
                        ["triaged", "Triat"],
                        ["awaiting_quote", "Așteaptă deviz"],
                        ["resolved", "Rezolvat fără intervenție"],
                        ["closed", "Închis"],
                        ["cancelled", "Anulat"],
                      ]),
                      field("note", "Motiv", "textarea"),
                    ]}
                    run={run}
                    onSubmit={(b, r) => r(`tickets/${w.id}/transition`, b)}
                  />}
                  {canManage && !w.work_order_id && (
                    <Form
                      title="Pregătește intervenția și devizul"
                      fields={serviceFields}
                      run={run}
                      onSubmit={(b, r) => r(`tickets/${w.id}/create-work`, b)}
                    />
                  )}
                </>
              )}
              {section === "aprobari" && org && (
                <>
                  {!rows.length ? (
                    <Empty><UiText text={"Nu există aprobări în așteptare."}/></Empty>
                  ) : (
                    <div className="pro-list">
                      {rows.map((a) => (
                        <Link
                          key={a.id}
                          href={"/pro/lucrari/" + a.work_order_id}
                          className="pro-row"
                        >
                          <div>
                            {a.title}
                            <small><UiText text={"Versiunea "}/>{a.quote_version} · {money(a.amount)}
                            </small>
                          </div>
                          <Badge status={a.decision} />
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
              {section === "rapoarte" && org && (
                <>
                  <div className="pro-form-grid mb-5">
                    <label className="pro-field"><UiText text={"De la"}/><input
                        type="date"
                        value={range.from}
                        onChange={(e) =>
                          setRange({ ...range, from: e.target.value })
                        }
                      />
                    </label>
                    <label className="pro-field"><UiText text={"Până la"}/><input
                        type="date"
                        value={range.to}
                        onChange={(e) =>
                          setRange({ ...range, to: e.target.value })
                        }
                      />
                    </label>
                    <label className="pro-field"><UiText text={"Proprietate"}/><select
                        value={range.property}
                        onChange={(e) =>
                          setRange({ ...range, property: e.target.value })
                        }
                      >
                        <option value=""><UiText text={"Toate proprietățile autorizate"}/></option>
                        {props.map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="pro-field"><UiText text={"Categorie"}/><select
                        value={range.category}
                        onChange={(e) =>
                          setRange({ ...range, category: e.target.value })
                        }
                      >
                        <option value=""><UiText text={"Toate categoriile"}/></option>
                        {Object.entries(SERVICES).map(([id, label]) => (
                          <option key={id} value={id}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="pro-stat">
                    <strong>
                      {money(rows.reduce((n, r) => n + r.amount, 0))}
                    </strong>
                    <span><UiText text={"Costuri finale validate · maximum 1.000 intrări recente"}/></span>
                  </div>
                  <div className="pro-actions">
                    <a
                      href={
                        "/api/pro/reports/export?organization_id=" +
                        encodeURIComponent(org) +
                        "&" +
                        new URLSearchParams(range)
                      }
                      className="v2-btn v2-btn-primary"
                    ><UiText text={"Descarcă CSV"}/></a>
                  </div>
                  <div className="pro-card pro-table-wrap">
                    <table className="pro-table">
                      <thead>
                        <tr>
                          <th><UiText text={"Data"}/></th>
                          <th><UiText text={"Proprietate"}/></th>
                          <th><UiText text={"Categorie"}/></th>
                          <th><UiText text={"Cost"}/></th>
                          <th><UiText text={"Stare"}/></th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r) => (
                          <tr key={r.id}>
                            <td>{date(r.created_at)}</td>
                            <td>{r.property_name}</td>
                            <td>{r.category}</td>
                            <td>{money(r.amount)}</td>
                            <td>
                              {r.status}
                              {canFinance && <Form
                                title="Document extern"
                                fields={[
                                  field("status", "Stare", "select", [
                                    ["invoiced_external", "Facturat extern"],
                                    ["paid_external", "Achitat extern"],
                                  ]),
                                  field("invoice_ref", "Referință document"),
                                ]}
                                run={run}
                                onSubmit={(b, send) => send("costs/" + r.id, b)}
                              />}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
              {section === "echipa" && (
                <>
                  <Form
                    title="Acceptă invitația"
                    fields={[
                      {
                        ...field("token", "Codul invitației", "password"),
                        value: inviteToken,
                      },
                    ]}
                    run={run}
                    onSubmit={(b, r) => r("invites/accept", b)}
                  />
                  {org && canSuper && (
                    <>
                      <h2><UiText text={"Invitații"}/></h2>
                      {(data.invites ?? []).map((i: Row) => (
                        <div className="pro-row mb-2" key={i.id}>
                          <span>
                            {i.email} · {i.role} ·{" "}
                            {i.used_at
                              ? <UiText text={"Acceptată"}/>
                              : i.revoked
                                ? <UiText text={"Revocată"}/>
                                : <UiText text={"În așteptare"}/>}
                          </span>
                          {!i.used_at && !i.revoked && (
                            <button
                              className="v2-btn v2-btn-secondary"
                              onClick={() =>
                                run(`invites/${i.id}/revoke`, {}).catch((e) =>
                                  setError(e.message),
                                )
                              }
                            ><UiText text={"Revocă invitația"}/></button>
                          )}
                        </div>
                      ))}
                      <div className="pro-list mt-4">
                        {rows.map((m) => (
                          <div className="pro-row" key={m.id}>
                            <div>
                              {m.name}
                              <small>
                                {m.role} · {m.active ? <UiText text={"Activ"}/> : <UiText text={"Revocat"}/>}
                              </small>
                            </div>
                            {m.role !== "owner" && !!m.active && (
                              <button
                                className="v2-btn v2-btn-secondary"
                                onClick={() =>
                                  run("members/" + m.id, {}).catch((e) =>
                                    setError(e.message),
                                  )
                                }
                              ><UiText text={"Revocă accesul"}/></button>
                            )}
                          </div>
                        ))}
                      </div>
                      <Form
                        title="Creează invitație"
                        fields={[
                          field("email", "E-mail", "email"),
                          field("role", "Rol", "select", [
                            ["manager", "Manager"],
                            ["approver", "Aprobator"],
                            ["viewer", "Vizualizare"],
                            ["contact", "Contact proprietate"],
                          ]),
                          { ...propField, optional: true },
                        ]}
                        run={run}
                        onSubmit={(b, r) =>
                          r("invites", {
                            ...b,
                            organization_id: org,
                            scope: b.property_id ? [b.property_id] : [],
                          })
                        }
                      />
                    </>
                  )}
                </>
              )}
              {section === "setari" && organization && (
                <>
                  <div className="pro-card">
                    <p><UiText text={"Status: "}/><Badge status={organization.status} />
                    </p>
                    <p className="mt-3"><UiText text={"Monedă: RON · Prag: "}/>{money(organization.threshold)}<UiText text={" · Calcul pe suma brută"}/></p>
                  </div>
                  {canSuper && <Form
                    title="Salvează politica de aprobare"
                    fields={[
                      {
                        ...field(
                          "threshold",
                          "Prag de aprobare, bani",
                          "number",
                        ),
                        value: organization.threshold,
                      },
                      field("separate", "Aprobator distinct", "select", [
                        ["yes", "Da"],
                        ["no", "Nu — numai cu mandat contractual"],
                      ]),
                    ]}
                    run={run}
                    onSubmit={(b, r) =>
                      r("settings/" + org, {
                        threshold: b.threshold,
                        separate_approver: b.separate === "yes",
                      })
                    }
                  />}
                </>
              )}
              {section === "operator" && context.admin && (
                <>
                  <h2><UiText text={"Activare controlată"}/></h2>
                  <p className="pro-muted"><UiText text={"Folosește numai conturi existente și referințe de contract/verificare reale. Datele financiare nu pot fi aprobate de admin."}/></p>
                  {canSuper && <Form
                    title="Creează organizație"
                    fields={[
                      field("name", "Denumire"),
                      field("city", "Oraș"),
                      field("owner_id", "ID cont Owner"),
                      field("contract_ref", "Referință acceptare contractuală"),
                    ]}
                    run={run}
                    onSubmit={(b, r) => r("organizations", b)}
                  />}
                  {org && canSuper && (
                    <Form
                      title="Activează portofoliul configurat"
                      fields={[]}
                      run={run}
                      onSubmit={(b, r) => r("activate/" + org, b)}
                    />
                  )}
                  {canManage && <Form
                    title="Activează partener verificat"
                    fields={[
                      field("name", "Firma"),
                      field("legal_id", "CUI"),
                      field("user_id", "ID cont firmă"),
                      field("city", "Oraș"),
                      field(
                        "service",
                        "Serviciu",
                        "select",
                        Object.entries(SERVICES),
                      ),
                      field("verified_ref", "Referință verificare documente"),
                    ]}
                    run={run}
                    onSubmit={(b, r) =>
                      r("partners", {
                        ...b,
                        cities: [b.city],
                        services: [b.service],
                      })
                    }
                  />}
                  {org && canSuper && (
                    <Form
                      title="Alocă operator NITIDO"
                      fields={[field("user_id", "ID cont operator")]}
                      run={run}
                      onSubmit={(b, r) => r("staff/" + org, b)}
                    />
                  )}
                  <h2><UiText text={"Parteneri"}/></h2>
                  {canManage && (data.partners ?? []).map((p: Row) => (
                    <Form
                      key={p.id}
                      title={p.name + " · " + p.status}
                      fields={[
                        field("status", "Stare", "select", [
                          ["active", "Activ"],
                          ["suspended", "Suspendat"],
                          ["inactive", "Inactiv"],
                        ]),
                        field("note", "Motiv", "textarea"),
                      ]}
                      run={run}
                      onSubmit={(b, r) => r("partners/" + p.id, b)}
                    />
                  ))}
                  <h2><UiText text={"Cereri de evaluare"}/></h2>
                  {(data.leads ?? []).map((l: Row) => (
                    <div className="pro-card mb-3" key={l.id}>
                      <strong>{l.name}</strong>
                      <p className="text-sm pro-muted">
                        {l.city} · {l.email} · {l.phone} · {l.status}
                      </p>
                      {canManage && <Form
                        title="Revizuiește cererea"
                        fields={[
                          field("status", "Decizie", "select", [
                            ["in_review", "În analiză"],
                            ["qualified", "Eligibil"],
                            ["rejected", "Respins"],
                            ["converted", "Activat contractual"],
                          ]),
                          field("note", "Notă", "textarea"),
                        ]}
                        run={run}
                        onSubmit={(b, r) => r("leads/" + l.id, b)}
                      />}
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
function Checklist({ work: w, run }: { work: Row; run: Run }) {
  const [answers, setAnswers] = useState<Row>(JSON.parse(w.answers_json)),
    [err, setErr] = useState("");
  const items: string[] = JSON.parse(w.checklist_json);
  return (
    <>
      <div className="pro-list">
        {items.map((item, i) => (
          <label className="pro-check" key={item}>
            <input
              type="checkbox"
              checked={!!answers[String(i)]}
              disabled={!w.permissions.partner || w.status !== "in_progress"}
              onChange={(e) =>
                setAnswers({ ...answers, [String(i)]: e.target.checked })
              }
            />
            {item}
          </label>
        ))}
      </div>
      {w.permissions.partner && w.status === "in_progress" && (
        <button
          className="v2-btn v2-btn-primary mt-4"
          onClick={() =>
            run(`work-orders/${w.id}/checklist`, {
              revision: w.revision,
              answers,
            }).catch((e) => setErr(e.message))
          }
        ><UiText text={"Salvează checklistul"}/></button>
      )}
      {err && (
        <p role="alert" className="pro-error">
          {err}
        </p>
      )}
    </>
  );
}
function Upload({
  beforeOnly = false,
  entity,
  id,
  onDone,
}: {
  beforeOnly?: boolean;
  entity: string;
  id: string;
  onDone: () => void;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-5"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const fd = new FormData(e.currentTarget);
        fd.set(entity, id);
        try {
          const r = await fetch("/api/pro/media", { method: "POST", body: fd }),
            d = await r.json();
          if (!r.ok) throw new Error(d.error);
          onDone();
        } catch (e) {
          setError(e instanceof Error ? e.message : "Încărcare nereușită.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="pro-field"><UiText text={"Fotografie JPEG / PNG / WEBP"}/><input
          type="file"
          name="file"
          accept="image/jpeg,image/png,image/webp"
          required
        />
      </label>
      <label className="pro-field mt-3"><UiText text={"Categorie"}/><select name="category" key={String(beforeOnly)} defaultValue={beforeOnly ? "before" : "after"}>
          {!beforeOnly && <option value="after"><UiText text={"După execuție"}/></option>}
          <option value="before"><UiText text={"Înainte"}/></option>
          {!beforeOnly && <>
            <option value="issue"><UiText text={"Problemă"}/></option>
            <option value="resolution"><UiText text={"Remediere"}/></option>
            <option value="quote"><UiText text={"Deviz"}/></option>
          </>}
        </select>
      </label>
      <button className="v2-btn v2-btn-secondary mt-3" disabled={busy}>
        {busy ? <UiText text={"Se încarcă…"}/> : <UiText text={"Încarcă dovada"}/>}
      </button>
      {error && (
        <p role="alert" className="pro-error">
          {<UiText text={error}/>}
        </p>
      )}
    </form>
  );
}
