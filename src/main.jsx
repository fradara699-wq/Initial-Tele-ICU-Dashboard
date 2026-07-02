import React, {useEffect, useMemo, useState} from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertTriangle, HeartPulse, Search, Stethoscope, Users, X } from 'lucide-react';
import './styles.css';

const pick = (f, names) => names.map(n => f?.[n]).find(v => v !== undefined && v !== null && String(v).trim() !== '') || '';
const yes = v => ['si','sí','yes','true','1','x'].includes(String(v||'').toLowerCase().trim());
const days = d => { if(!d) return '—'; const dt=new Date(d); if(isNaN(dt)) return '—'; return Math.max(1, Math.ceil((Date.now()-dt)/86400000)); };

function norm(r){
  const f = r.fields || {};
  return {
    id: r.id,
    name: pick(f,['Name','Nombre','Paciente']),
    dni: pick(f,['DNI','Documento']),
    centro: pick(f,['Centro','CENTRO','Institución','Institucion']) || 'Sin centro',
    fi: pick(f,['FI','Fecha ingreso','Fecha de ingreso']),
    tipo: pick(f,['tipo','Tipo']),
    dx: pick(f,['Dx inicial','Diagnóstico inicial','Diagnostico inicial']),
    dxf: pick(f,['Dx final','Diagnóstico final','Diagnostico final']),
    dxs: pick(f,['Dxs','Diagnósticos asociados','Diagnosticos asociados']),
    edad: pick(f,['Edad','age']),
    sexo: pick(f,['Sexo','sex']),
    enf: pick(f,['enfermedad actual','Enfermedad actual','Evolución','Evolucion']),
    resp: pick(f,['Asistencia respiratoria','ARM','Resp']),
    vaso: pick(f,['Vasoactivos','Vaso','Vasopresores']),
    renal: pick(f,['NR','TRR','Terapia de reemplazo renal','Renal']),
    atb: pick(f,['ATB','Antibióticos','Antibioticos']),
    status: pick(f,['Status','Estado']),
    muerte: pick(f,['Muerte'])
  };
}

const isActivo = p => !p.status || String(p.status).toLowerCase().includes('activo');
const isARM = p => yes(p.resp) || String(p.resp || '').toLowerCase().includes('arm');
const isVaso = p => yes(p.vaso) || String(p.vaso || '').trim().length > 1;
const isTRR = p => yes(p.renal) || String(p.renal || '').trim().length > 1;
const isMuerte = p => yes(p.muerte);

function App(){
  const [records,setRecords] = useState([]);
  const [q,setQ] = useState('');
  const [centro,setCentro] = useState('Todos');
  const [filter,setFilter] = useState('Todos');
  const [sel,setSel] = useState(null);
  const [err,setErr] = useState('');
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    fetch('/.netlify/functions/patients')
      .then(r=>r.json())
      .then(d=>{
        if(d.error) setErr(d.error);
        else {
          const p = d.map(norm);
          setRecords(p);
          setSel(p[0] || null);
        }
      })
      .catch(e=>setErr(e.message))
      .finally(()=>setLoading(false));
  },[]);

  const centros = useMemo(()=>['Todos', ...new Set(records.map(p=>p.centro).filter(Boolean))], [records]);

  const base = records.filter(p =>
    (centro === 'Todos' || p.centro === centro) &&
    [p.name,p.dni,p.centro,p.dx,p.dxf,p.dxs,p.enf].join(' ').toLowerCase().includes(q.toLowerCase())
  );

  const filtered = base.filter(p => {
    if(filter === 'Activos') return isActivo(p);
    if(filter === 'ARM') return isARM(p);
    if(filter === 'Vasoactivos') return isVaso(p);
    if(filter === 'TRR/NR') return isTRR(p);
    if(filter === 'Muerte') return isMuerte(p);
    return true;
  });

  const stats = {
    total: base.length,
    activos: base.filter(isActivo).length,
    arm: base.filter(isARM).length,
    vaso: base.filter(isVaso).length,
    trr: base.filter(isTRR).length,
    muerte: base.filter(isMuerte).length
  };

  const chooseFilter = (next) => {
    setFilter(prev => prev === next ? 'Todos' : next);
  };

  return (
    <div className="app">
      <aside>
        <h1>Tele ICU<br/>Dashboard</h1>
        <p>Panel operativo conectado a Airtable</p>
        {centros.map(c =>
          <button key={c} className={centro===c?'active':''} onClick={()=>setCentro(c)}>
            <Stethoscope size={16}/>{c}
          </button>
        )}
      </aside>

      <main>
        <header>
          <div>
            <h2>Pacientes Tele-ICU</h2>
            <span>{loading ? 'Cargando...' : `${filtered.length} pacientes visibles`}</span>
          </div>
          <label>
            <Search size={18}/>
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar nombre, DNI, centro o diagnóstico"/>
          </label>
        </header>

        {err && <div className="error">Error Airtable: {err}</div>}

        {filter !== 'Todos' && (
          <div className="activeFilter">
            Filtro activo: <strong>{filter}</strong>
            <button onClick={()=>setFilter('Todos')}><X size={14}/> Quitar filtro</button>
          </div>
        )}

        <section className="stats">
          <Card active={filter==='Todos'} onClick={()=>chooseFilter('Todos')} icon={<Users/>} n={stats.total} t="Total"/>
          <Card active={filter==='Activos'} onClick={()=>chooseFilter('Activos')} icon={<Activity/>} n={stats.activos} t="Activos"/>
          <Card active={filter==='ARM'} onClick={()=>chooseFilter('ARM')} icon={<HeartPulse/>} n={stats.arm} t="ARM"/>
          <Card active={filter==='Vasoactivos'} onClick={()=>chooseFilter('Vasoactivos')} icon={<HeartPulse/>} n={stats.vaso} t="Vasoactivos"/>
          <Card active={filter==='TRR/NR'} onClick={()=>chooseFilter('TRR/NR')} icon={<Activity/>} n={stats.trr} t="TRR/NR"/>
          <Card active={filter==='Muerte'} onClick={()=>chooseFilter('Muerte')} icon={<AlertTriangle/>} n={stats.muerte} t="Muerte"/>
        </section>

        <section className="grid">
          <div>
            {filtered.map(p =>
              <article key={p.id} onClick={()=>setSel(p)} className={sel?.id===p.id?'patient selected':'patient'}>
                <h3>{p.name || 'Sin nombre'}</h3>
                <p>{p.centro} · {p.edad || '—'} años · día {days(p.fi)}</p>
                <b>{p.dx || p.dxs || 'Sin diagnóstico cargado'}</b>
                <div>
                  {isARM(p) && <span>ARM</span>}
                  {isVaso(p) && <span>Vaso</span>}
                  {isTRR(p) && <span>TRR</span>}
                  {isMuerte(p) && <span>Muerte</span>}
                </div>
              </article>
            )}
          </div>
          <Detail p={sel}/>
        </section>
      </main>
    </div>
  );
}

function Card({icon,n,t,onClick,active}){
  return <button className={active ? 'card activeCard' : 'card'} onClick={onClick}>{icon}<strong>{n}</strong><span>{t}</span></button>;
}

function Row({k,v}){return <><dt>{k}</dt><dd>{v || '—'}</dd></>}

function Detail({p}){
  if(!p) return <section className="detail">Seleccione un paciente</section>;
  return (
    <section className="detail">
      <h2>{p.name}</h2>
      <p className="muted">{p.centro} · DNI {p.dni || '—'}</p>
      <dl>
        <Row k="Edad / Sexo" v={`${p.edad || '—'} / ${p.sexo || '—'}`}/>
        <Row k="Fecha ingreso" v={`${p.fi || '—'} · día ${days(p.fi)}`}/>
        <Row k="Diagnóstico inicial" v={p.dx}/>
        <Row k="Dx final" v={p.dxf}/>
        <Row k="Diagnósticos asociados" v={p.dxs}/>
        <Row k="Asistencia respiratoria" v={p.resp}/>
        <Row k="Vasoactivos" v={p.vaso}/>
        <Row k="NR / TRR" v={p.renal}/>
        <Row k="ATB" v={p.atb}/>
        <Row k="Enfermedad actual / evolución" v={p.enf}/>
      </dl>
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App/>);
