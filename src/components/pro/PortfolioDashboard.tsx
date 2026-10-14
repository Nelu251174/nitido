"use client";

import {UiText} from '@/components/UiText';
import Link from 'next/link';
import { money, SERVICES, STATUS } from '@/lib/pro/shared';
import type { portfolioReport } from '@/lib/pro/portfolioReport';

type Report = ReturnType<typeof portfolioReport>;
export type DashboardFilters = { from: string; to: string; property: string; category: string; property_page?: string };
const amount = (value: number | null) => value === null ? 'Necunoscut' : money(value);

export default function PortfolioDashboard({ report, filters, properties, onChange }: {
  report: Report; filters: DashboardFilters; properties: [string, string][]; onChange: (filters: DashboardFilters) => void;
}) {
  const change = (key: keyof DashboardFilters, value: string) => onChange({ ...filters, [key]: value, property_page: '0' });
  const exportQuery = new URLSearchParams({ organization_id: report.organizationId, from: report.period.from, to: report.period.to, property: report.filters.property, category: report.filters.category });
  const costs = report.clientCosts;
  return <>
    <div className="pro-form-grid mb-5">
      <label className="pro-field"><UiText text={"De la"}/><input type="date" value={filters.from || report.period.from} onChange={e => change('from', e.target.value)} /></label>
      <label className="pro-field"><UiText text={"Până la"}/><input type="date" value={filters.to || report.period.to} onChange={e => change('to', e.target.value)} /></label>
      <label className="pro-field"><UiText text={"Proprietate"}/><select value={filters.property} onChange={e => change('property', e.target.value)}>
        <option value=""><UiText text={"Toate proprietățile autorizate"}/></option>
        {properties.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <label className="pro-field"><UiText text={"Serviciu"}/><select value={filters.category} onChange={e => change('category', e.target.value)}>
        <option value=""><UiText text={"Toate serviciile"}/></option>
        {Object.entries(SERVICES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
    </div>
    <p className="pro-muted mb-4">{report.period.from} — {report.period.to}<UiText text={" · Calendarul României. Lucrările sunt selectate după ziua programată; stările și inventarul proprietăților reflectă situația actuală."}/></p>
    <div className="pro-stats">
      {[
        ['Proprietăți autorizate', report.properties.total], ['Proprietăți active', report.properties.active],
        ['Lucrări în interval', report.work.total], ['Finalizate', report.work.completed],
        ['Anulate', report.work.cancelled], ['Programate', report.work.scheduled],
        ['Acceptate', report.work.accepted], ['În desfășurare', report.work.inProgress],
        ['Spre verificare', report.work.awaitingReview], ['Remedieri cerute', report.work.rework],
        ['Aprobări în așteptare', report.approvals.pending], ['Lucrări din planuri recurente', report.recurrence.workOrders],
      ].map(([label, n]) => <div className="pro-stat" key={String(label)}><strong>{n}</strong><span>{label}</span></div>)}
    </div>
    <div className="pro-card mt-4">
      <h2><UiText text={"Recurențe și aprobări"}/></h2>
      <p><UiText text={"Apariții în zilele planificate: "}/>{report.recurrence.occurrences.generated}<UiText text={" generate, "}/>{report.recurrence.occurrences.skipped}<UiText text={" omise, "}/>{report.recurrence.occurrences.missed}<UiText text={" de verificat."}/></p>
      <p><UiText text={"Planuri în inventarul actual: "}/>{report.recurrence.rules.active}<UiText text={" active și "}/>{report.recurrence.rules.paused}<UiText text={" în pauză."}/></p>
      <p><UiText text={"Devizele curente ale lucrărilor selectate: "}/>{report.approvals.approved}<UiText text={" aprobate, "}/>{report.approvals.rejected}<UiText text={" respinse, "}/>{report.approvals.clarification}<UiText text={" cu clarificări cerute. Versiunile înlocuite nu sunt numărate din nou."}/></p>
      {!!report.approvals.missingCurrent && <p role="status" className="pro-muted">{report.approvals.missingCurrent}<UiText text={" lucrări cu autorizare financiară necesară nu au un deviz curent disponibil pentru raportare."}/></p>}
    </div>
    {!!report.completeness.unknownWorkDates && <p role="status" className="pro-muted mt-4">{report.completeness.unknownWorkDates}<UiText text={" lucrări autorizate au o dată invalidă și nu pot fi atribuite acestui interval."}/></p>}
    {costs && <div className="pro-card mt-4">
      <h2><UiText text={"Costuri aprobate pentru client"}/></h2>
      <p className="pro-muted"><UiText text={"Acces financiar pentru "}/>{costs.scope.properties}<UiText text={" proprietăți"}/>{costs.scope.organizationEntries ? <UiText text={' și intrările organizației fără proprietate'}/> : ''}<UiText text={". Sumele sunt în RON."}/></p>
      <div className="pro-stats mt-3">
        <div className="pro-stat"><strong>{amount(costs.registry.totalBani)}</strong><span><UiText text={"Registru: "}/>{costs.registry.entries}<UiText text={" intrări după data înregistrării"}/></span></div>
        <div className="pro-stat"><strong>{amount(costs.completedWork.totalBani)}</strong><span><UiText text={"Cost final pentru "}/>{costs.completedWork.completed}<UiText text={" lucrări finalizate din intervalul programat"}/></span></div>
      </div>
      {!costs.registry.complete && <p role="status" className="pro-muted mt-3"><UiText text={"Totalul registrului este incomplet. Suma cunoscută: "}/>{money(costs.registry.knownBani)}; {costs.registry.unknownEntries}<UiText text={" intrări cu sumă invalidă și "}/>{report.completeness.unknownCostDates}<UiText text={" cu dată invalidă."}/></p>}
      {!costs.completedWork.complete && <p role="status" className="pro-muted mt-3">{costs.completedWork.unknownWorks}<UiText text={" lucrări finalizate nu au un cost final autorizat cunoscut. Suma cunoscută: "}/>{money(costs.completedWork.knownBani)}.</p>}
      {!!costs.completedWork.missingRegistry && <p className="pro-muted mt-3">{costs.completedWork.missingRegistry}<UiText text={" lucrări finalizate nu au o intrare în registrul de costuri. Cele două cohorte se verifică separat și nu se adună."}/></p>}
      <a className="v2-btn v2-btn-primary mt-4" href={'/api/pro/reports/export?' + exportQuery}><UiText text={"Descarcă registrul CSV"}/></a>
      <p className="pro-muted mt-2"><UiText text={"CSV folosește același interval și acces financiar; peste 1.000 de intrări este necesară restrângerea perioadei, proprietății sau serviciului."}/></p>
    </div>}
    {report.internalMargin && <div className="pro-card mt-4"><h2><UiText text={"Marjă internă NITIDO"}/></h2><p><UiText text={"Necunoscută. "}/>{report.internalMargin.reason}</p></div>}
    <div className="pro-card pro-table-wrap mt-4">
      <h2><UiText text={"Portofoliu consolidat"}/></h2>
      <table className="pro-table"><thead><tr><th><UiText text={"Proprietate"}/></th><th><UiText text={"Stare"}/></th><th><UiText text={"Lucrări"}/></th><th><UiText text={"Finalizate"}/></th><th><UiText text={"Aprobări în așteptare"}/></th><th><UiText text={"Recurente"}/></th><th><UiText text={"Apariții de verificat"}/></th>{costs && <th><UiText text={"Cost în registru"}/></th>}</tr></thead>
        <tbody>{report.propertyRows.map(row => <tr key={row.id}>
          <td><Link href={'/pro/proprietati/' + row.id}>{row.name}</Link></td><td>{STATUS[row.status] ?? row.status}</td>
          <td>{row.works}</td><td>{row.completed}</td><td>{row.pendingApprovals}</td><td>{row.recurringWorks}</td><td>{row.missedOccurrences}</td>
          {costs && <td>{row.clientCosts ? amount(row.clientCosts.totalBani) : <UiText text={'Acces restricționat'}/>}</td>}
        </tr>)}</tbody>
      </table>
      {!report.propertyRows.length && <p className="pro-muted mt-3"><UiText text={"Nu există proprietăți autorizate pentru această selecție."}/></p>}
      <p className="pro-muted mt-3"><UiText text={"Pagina "}/>{report.pagination.page + 1} · {report.pagination.returnedProperties}<UiText text={" din "}/>{report.pagination.totalProperties}<UiText text={" proprietăți. Indicatorii de mai sus acoperă întreaga selecție autorizată."}/></p>
      <div className="pro-actions mt-3">
        {report.pagination.page > 0 && <button className="v2-btn v2-btn-secondary" onClick={() => onChange({ ...filters, property_page: String(report.pagination.page - 1) })}><UiText text={"Pagina anterioară"}/></button>}
        {report.pagination.nextPage !== null && <button className="v2-btn v2-btn-secondary" onClick={() => onChange({ ...filters, property_page: String(report.pagination.nextPage) })}><UiText text={"Pagina următoare"}/></button>}
      </div>
    </div>
  </>;
}
