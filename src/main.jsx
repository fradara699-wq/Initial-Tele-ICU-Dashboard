import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Building2, Search, Stethoscope, Users, HeartPulse, Wind, Droplets, AlertTriangle } from 'lucide-react';
import './styles.css';

const FIELD = {
  name: 'Name', dni: 'DNI', center: 'Centro', date: 'FI', type: 'tipo', dxInicial: 'Dx inicial', dxFinal: 'Dx final', dxs: 'Dxs', current: 'enfermedad actual', sex: 'Sexo', age: 'Edad', app: 'APP', status: 'Status', resp: 'Asistencia respiratoria', atb: 'ATB', vaso: 'Vasoactivos', renal: 'NR', piso: 'Piso', muerte: 'Muerte', derivacion: 'Derivación', alta: 'Alta a domicil', altaVol: 'Alta_voluntaria', egreso: 'Egreso'
};

function text(v){ return (v ?? '').toString().trim(); }
function yes(v){ const s=text(v).toLowerCase(); return !!s && !['no','nan','false','0'].includes(s); }
function hasAny(v, terms){ const s=text(v).toLowerCase(); return terms.some(t=>s.includes(t)); }
function parseDateAR(v){ const s=text(v); const [d,m,y]=s.split(/[\/\-]/).map(Number); if(!d||!m||!y) return null; return new Date(y,m-1,d); }
function daysSince(v){ const d=parseDateAR(v); if(!d) return '—'; return Math.max(0, Math.floor((Date.now()-d.getTime())/86400000)); }

const SAMPLE = [
  { id:'demo1', fields:{ Name:'Paciente demo', DNI:'00000000', Centro:'Demo', FI:'01/07/2026', tipo:'médico', 'Dx inicial':'Sepsis respiratoria', Dxs:'Shock séptico, AKI', 'enfermedad actual':'Ejemplo de ficha. Cargá las variables de Airtable para ver datos reales.', Sexo:'F', Edad:70, APP:'HTA', Status:'In progress', 'Asistencia respiratoria':'ARM', ATB:'PTZ', Vasoactivos:'Nora', NR:'TRR' } }
];

async function fetchAirtable(){
  const token = import.meta.env.VITE_AIRTABLE_TOKEN;
  const baseId = import.meta.env.VITE_AIRTABLE_BASE_ID;
  const table = import.meta.env.VITE_AIRTABLE_TABLE_NAME || 'Table 1';
  if(!token || !baseId || token.includes('TU_TOKEN') || baseId.includes('TU_BASE')) return SAMPLE;
  let all=[]; let offset='';
  do {
    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?pageSize=100${offset ? `&offset=${offset}` : ''}`;
    const res = await fetch(url, { headers:{ Authorization:`Bearer ${token}` }});
    if(!res.ok) throw new Error(`Airtable error ${res.status}: ${await res.text()}`);
    const json = await res.json(); all = all.concat(json.records || []); offset = json.offset;
  } while(offset);
  return all;
}

function Stat({icon:Icon,label,value}){ return <div className="stat"><Icon size={22}/><div><b>{value}</b><span>{label}</span></div></div> }

function App(){
  const [records,setRecords]=useState([]); const [loading,setLoading]=useState(true); const [error,setError]=useState('');
  const [q,setQ]=useState(''); const [center,setCenter]=useState('Todos'); const [selected,setSelected]=useState(null);
  useEffect(()=>{ fetchAirtable().then(r=>{setRecords(r); setSelected(r[0]||null)}).catch(e=>setError(e.message)).finally(()=>setLoading(false)); },[]);
  const rows = records.map(r=>({id:r.id, ...r.fields}));
  const centers = ['Todos', ...Array.from(new Set(rows.map(r=>text(r[FIELD.center])).filter(Boolean)))];
  const filtered = rows.filter(r => (center==='Todos'||text(r[FIELD.center])===center) && [FIELD.name,FIELD.dni,FIELD.center,FIELD.dxInicial,FIELD.dxs].some(k=>text(r[k]).toLowerCase().includes(q.toLowerCase())));
  const stats = useMemo(()=>({ total: rows.length, active: rows.filter(r=>text(r[FIELD.status]).toLowerCase().includes('progress')).length, arm: rows.filter(r=>hasAny(r[FIELD.resp],['arm','vmi','mecánica'])).length, vni: rows.filter(r=>hasAny(r[FIELD.resp],['vni','bipap'])).length, vaso: rows.filter(r=>yes(r[FIELD.vaso])).length, renal: rows.filter(r=>yes(r[FIELD.renal])).length, muerte: rows.filter(r=>yes(r[FIELD.muerte])).length }),[records]);
  const s = selected;
  return <div className="app">
    <aside><h1>Tele ICU<br/><span>Dashboard</span></h1><p className="muted">Panel operativo conectado a Airtable</p><div className="centers">{centers.map(c=><button className={c===center?'active':''} onClick={()=>setCenter(c)} key={c}><Building2 size={16}/>{c}</button>)}</div></aside>
    <main>
      <header><div><h2>Pacientes Tele-ICU</h2><p>{loading?'Cargando...':`${filtered.length} pacientes visibles`}</p></div><div className="search"><Search size={18}/><input placeholder="Buscar nombre, DNI, centro o diagnóstico" value={q} onChange={e=>setQ(e.target.value)}/></div></header>
      {error && <div className="error">{error}</div>}
      <section className="stats"><Stat icon={Users} label="Total" value={stats.total}/><Stat icon={Activity} label="Activos" value={stats.active}/><Stat icon={Wind} label="ARM" value={stats.arm}/><Stat icon={HeartPulse} label="Vasoactivos" value={stats.vaso}/><Stat icon={Droplets} label="TRR/NR" value={stats.renal}/><Stat icon={AlertTriangle} label="Muerte" value={stats.muerte}/></section>
      <div className="grid">
        <section className="list">{filtered.map(r=><article key={r.id} className={s?.id===r.id?'card selected':'card'} onClick={()=>setSelected(r)}><div><b>{text(r[FIELD.name])||'Sin nombre'}</b><span>{text(r[FIELD.center])||'Sin centro'} · {text(r[FIELD.age])||'—'} años · día {daysSince(r[FIELD.date])}</span></div><small>{text(r[FIELD.dxInicial])||text(r[FIELD.dxs])||'Sin diagnóstico'}</small><div className="badges">{hasAny(r[FIELD.resp],['arm','vni'])&&<em>Resp</em>}{yes(r[FIELD.vaso])&&<em>Vaso</em>}{yes(r[FIELD.renal])&&<em>Renal</em>}</div></article>)}</section>
        <section className="detail">{s ? <><div className="detailHead"><Stethoscope/><div><h3>{text(s[FIELD.name])}</h3><p>{text(s[FIELD.center])} · DNI {text(s[FIELD.dni])||'—'}</p></div></div><dl><dt>Edad / Sexo</dt><dd>{text(s[FIELD.age])||'—'} / {text(s[FIELD.sex])||'—'}</dd><dt>Fecha ingreso</dt><dd>{text(s[FIELD.date])||'—'} · día {daysSince(s[FIELD.date])}</dd><dt>Diagnóstico inicial</dt><dd>{text(s[FIELD.dxInicial])||'—'}</dd><dt>Diagnósticos asociados</dt><dd>{text(s[FIELD.dxs])||'—'}</dd><dt>Asistencia respiratoria</dt><dd>{text(s[FIELD.resp])||'—'}</dd><dt>Vasoactivos</dt><dd>{text(s[FIELD.vaso])||'—'}</dd><dt>NR / TRR</dt><dd>{text(s[FIELD.renal])||'—'}</dd><dt>ATB</dt><dd>{text(s[FIELD.atb])||'—'}</dd><dt>Enfermedad actual / evolución</dt><dd className="long">{text(s[FIELD.current])||'—'}</dd></dl></> : <p>Seleccioná un paciente</p>}</section>
      </div>
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App/>);
