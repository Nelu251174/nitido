"use client";

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
      <label className="pro-field">De la<input type="date" value={filters.from || report.period.from} onChange={e => change('from', e.target.value)} /></label>
      <label className="pro-field">Până la<input type="date" value={filters.to || report.period.to} onChange={e => change('to', e.target.value)} /></label>
      <label className="pro-field">Proprietate<select value={filters.property} onChange={e => change('property', e.target.value)}>
        <option value="">Toate proprietățile autorizate</option>
        {properties.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
      <label className="pro-field">Serviciu<select value={filters.category} onChange={e => change('category', e.target.value)}>
        <option value="">Toate serviciile</option>
        {Object.entries(SERVICES).map(([id, name]) => <option key={id} value={id}>{name}</option>)}
      </select></label>
    </div>
    <p className="pro-muted mb-4">{report.period.from} — {report.period.to} · Calendarul României. Lucrările sunt selectate după ziua programată; stările și inventarul proprietăților reflectă situația actuală.</p>
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
      <h2>Recurențe și aprobări</h2>
      <p>Apariții în zilele planificate: {report.recurrence.occurrences.generated} generate, {report.recurrence.occurrences.skipped} omise, {report.recurrence.occurrences.missed} de verificat.</p>
      <p>Planuri în inventarul actual: {report.recurrence.rules.active} active și {report.recurrence.rules.paused} în pauză.</p>
      <p>Devizele curente ale lucrărilor selectate: {report.approvals.approved} aprobate, {report.approvals.rejected} respinse, {report.approvals.clarification} cu clarificări cerute. Versiunile înlocuite nu sunt numărate din nou.</p>
      {!!report.approvals.missingCurrent && <p role="status" className="pro-muted">{report.approvals.missingCurrent} lucrări cu autorizare financiară necesară nu au un deviz curent disponibil pentru raportare.</p>}
    </div>
    {!!report.completeness.unknownWorkDates && <p role="status" className="pro-muted mt-4">{report.completeness.unknownWorkDates} lucrări autorizate au o dată invalidă și nu pot fi atribuite acestui interval.</p>}
    {costs && <div className="pro-card mt-4">
      <h2>Costuri aprobate pentru client</h2>
      <p className="pro-muted">Acces financiar pentru {costs.scope.properties} proprietăți{costs.scope.organizationEntries ? ' și intrările organizației fără proprietate' : ''}. Sumele sunt în RON.</p>
      <div className="pro-stats mt-3">
        <div className="pro-stat"><strong>{amount(costs.registry.totalBani)}</strong><span>Registru: {costs.registry.entries} intrări după data înregistrării</span></div>
        <div className="pro-stat"><strong>{amount(costs.completedWork.totalBani)}</strong><span>Cost final pentru {costs.completedWork.completed} lucrări finalizate din intervalul programat</span></div>
      </div>
      {!costs.registry.complete && <p role="status" className="pro-muted mt-3">Totalul registrului este incomplet. Suma cunoscută: {money(costs.registry.knownBani)}; {costs.registry.unknownEntries} intrări cu sumă invalidă și {report.completeness.unknownCostDates} cu dată invalidă.</p>}
      {!costs.completedWork.complete && <p role="status" className="pro-muted mt-3">{costs.completedWork.unknownWorks} lucrări finalizate nu au un cost final autorizat cunoscut. Suma cunoscută: {money(costs.completedWork.knownBani)}.</p>}
      {!!costs.completedWork.missingRegistry && <p className="pro-muted mt-3">{costs.completedWork.missingRegistry} lucrări finalizate nu au o intrare în registrul de costuri. Cele două cohorte se verifică separat și nu se adună.</p>}
      <a className="v2-btn v2-btn-primary mt-4" href={'/api/pro/reports/export?' + exportQuery}>Descarcă registrul CSV</a>
      <p className="pro-muted mt-2">CSV folosește același interval și acces financiar; peste 1.000 de intrări este necesară restrângerea perioadei, proprietății sau serviciului.</p>
    </div>}
    {report.internalMargin && <div className="pro-card mt-4"><h2>Marjă internă NITIDO</h2><p>Necunoscută. {report.internalMargin.reason}</p></div>}
    <div className="pro-card pro-table-wrap mt-4">
      <h2>Portofoliu consolidat</h2>
      <table className="pro-table"><thead><tr><th>Proprietate</th><th>Stare</th><th>Lucrări</th><th>Finalizate</th><th>Aprobări în așteptare</th><th>Recurente</th><th>Apariții de verificat</th>{costs && <th>Cost în registru</th>}</tr></thead>
        <tbody>{report.propertyRows.map(row => <tr key={row.id}>
          <td><Link href={'/pro/proprietati/' + row.id}>{row.name}</Link></td><td>{STATUS[row.status] ?? row.status}</td>
          <td>{row.works}</td><td>{row.completed}</td><td>{row.pendingApprovals}</td><td>{row.recurringWorks}</td><td>{row.missedOccurrences}</td>
          {costs && <td>{row.clientCosts ? amount(row.clientCosts.totalBani) : 'Acces restricționat'}</td>}
        </tr>)}</tbody>
      </table>
      {!report.propertyRows.length && <p className="pro-muted mt-3">Nu există proprietăți autorizate pentru această selecție.</p>}
      <p className="pro-muted mt-3">Pagina {report.pagination.page + 1} · {report.pagination.returnedProperties} din {report.pagination.totalProperties} proprietăți. Indicatorii de mai sus acoperă întreaga selecție autorizată.</p>
      <div className="pro-actions mt-3">
        {report.pagination.page > 0 && <button className="v2-btn v2-btn-secondary" onClick={() => onChange({ ...filters, property_page: String(report.pagination.page - 1) })}>Pagina anterioară</button>}
        {report.pagination.nextPage !== null && <button className="v2-btn v2-btn-secondary" onClick={() => onChange({ ...filters, property_page: String(report.pagination.nextPage) })}>Pagina următoare</button>}
      </div>
    </div>
  </>;
}
