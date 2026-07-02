import React, {useEffect, useMemo, useState} from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertTriangle, HeartPulse, Pencil, Plus, Save, Search, Stethoscope, Users, X } from 'lucide-react';
import './styles.css';

const pick = (f, names) => names.map(n => f?.[n]).find(v => v !== undefined && v !== null && String(v).trim() !== '') || '';
const txt = v => {
  if (Array.isArray(v)) return v.join(' ').toLowerCase().trim();
  if (typeof v === 'object' && v !== null) return String(v.name || v.value || '').toLowerCase().trim();
  return String(v || '').toLowerCase().trim();
};
const clean = v => {
  if (Array.isArray(v)) return v.join(', ').trim();
  if (typeof v === 'object' && v !== null) return String(v.name || v.value || '').trim();
  return String(v || '').trim();
};
const yes = v => ['si','sí','yes','true','1','x'].includes(txt(v));
const days = d => { if(!d) return '—'; const dt=new Date(d); if(isNaN(dt)) return '—'; return Math.max(1, Math.ceil((Date.now()-dt)/86400000)); };

const FIELD = {
  name: 'Name',
  dni: 'DNI',
  centro: 'Centro',
  fi: 'FI',
  tipo: 'tipo',
  dx: 'Dx inicial',
  dxf: 'Dx final',
  dxs: 'Dxs',
  edad: 'Edad',
  sexo: 'Sexo',
  enf: 'enfermedad actual',
  resp: 'Asistencia respiratoria',
  vaso: 'Vasoactivos',
  renal: 'NR',
  atb: 'ATB',
  status: 'Status',
  muerte: 'Muerte',
};

function norm(r){
  const f = r.fields || {};
  return {
    id: r.id,
    name: pick(f,['Name','Nombre','Paciente']),
    dni: pick(f,['DNI','Documento']),
    centro: clean(pick(f,['Centro','CENTRO','Institución','Institucion'])) || 'Sin centro',
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
    status: pick(f,['Status','Estado','Internado','Activo']),
    muerte: pick(f,['Muerte'])
  };
}

const isMuerte = p => yes(p.muerte) || txt(p.status).includes('falle') || txt(p.status).includes('muerte');
const isEgresado = p => ['alta','egreso','egresado','derivado','fallecido','muerte','óbito','obito'].some(w => txt(p.status).includes(w));
const isInternado = p => {
  const s = txt(p.status).replace(/\s+/g, ' ');
  // Airtable muestra "In progress"; aceptamos variantes como "in progres", "progress", "prog", etc.
  if (s.includes('progress') || s.includes('progres') || s.includes('prog')) return true;
  if (isMuerte(p) || isEgresado(p)) return false;
  if (['internado','internada','activo','activa','actual','hospitalizado','uti','ucc'].some(w => s.includes(w))) return true;
  return false;
};
const isARM = p => yes(p.resp) || txt(p.resp).includes('arm') || txt(p.resp).includes('invasiva');
const isVaso = p => yes(p.vaso) || String(p.vaso || '').trim().length > 1;
const isTRR = p => yes(p.renal) || String(p.renal || '').trim().length > 1;

function fieldsFromForm(form){
  const fields = {};
  Object.entries(FIELD).forEach(([key, airtableName]) => {
    const value = form[key];
    if (value !== undefined) fields[airtableName] = value;
  });
  return fields;
}

function emptyPatient(){
  return {
    name:'', dni:'', centro:'', fi:new Date().toISOString().slice(0,10),
    tipo:'medico', dx:'', dxf:'', dxs:'', edad:'', sexo:'',
    enf:'', resp:'', vaso:'', renal:'', atb:'', status:'In progress', muerte:''
  };
}

function App(){
  const [records,setRecords] = useState([]);
  const [q,setQ] = useState('');
  const [centro,setCentro] = useState('Todos');
  const [filter,setFilter] = useState('Internados');
  const [sel,setSel] = useState(null);
  const [err,setErr] = useState('');
  const [loading,setLoading] = useState(true);
  const [editing,setEditing] = useState(null);
  const [saving,setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch('/.netlify/functions/patients')
      .then(r=>r.json())
      .then(d=>{
        if(d.error) setErr(d.error);
        else {
          const p = d.map(norm);
          setRecords(p);
          setSel(current => current ? (p.find(x => x.id === current.id) || p.find(isInternado) || p[0] || null) : (p.find(isInternado) || p[0] || null));
        }
      })
      .catch(e=>setErr(e.message))
      .finally(()=>setLoading(false));
  };

  useEffect(()=>{ load(); },[]);

  const centros = useMemo(()=>['Todos', ...new Set(records.map(p=>p.centro).filter(Boolean))], [records]);

  const base = records.filter(p =>
    (centro === 'Todos' || p.centro === centro) &&
    [p.name,p.dni,p.centro,p.dx,p.dxf,p.dxs,p.enf,p.status].join(' ').toLowerCase().includes(q.toLowerCase())
  );

  const filtered = base.filter(p => {
    if(filter === 'Internados') return isInternado(p);
    if(filter === 'ARM') return isInternado(p) && isARM(p);
    if(filter === 'Vasoactivos') return isInternado(p) && isVaso(p);
    if(filter === 'TRR/NR') return isInternado(p) && isTRR(p);
    if(filter === 'Muerte') return isMuerte(p);
    if(filter === 'Todos') return true;
    return true;
  });

  const stats = {
    total: base.length,
    internados: base.filter(isInternado).length,
    arm: base.filter(p=>isInternado(p) && isARM(p)).length,
    vaso: base.filter(p=>isInternado(p) && isVaso(p)).length,
    trr: base.filter(p=>isInternado(p) && isTRR(p)).length,
    muerte: base.filter(isMuerte).length
  };

  const chooseFilter = (next) => setFilter(prev => prev === next ? 'Internados' : next);

  const savePatient = async (form) => {
    setSaving(true);
    setErr('');
    try {
      const isNew = !form.id;
      const payload = isNew
        ? { fields: fieldsFromForm(form) }
        : { id: form.id, fields: fieldsFromForm(form) };

      const res = await fetch('/.netlify/functions/patients', {
        method: isNew ? 'POST' : 'PATCH',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error guardando paciente');

      setEditing(null);
      load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  };

  const quickStatus = async (patient, status) => {
    await savePatient({...patient, status});
  };

  return (
    <div className="app">
      <aside>
        <h1>Tele ICU<br/>Dashboard</h1>
        <p>Panel operativo conectado a Airtable</p>
        <button className="newPatient" onClick={()=>setEditing(emptyPatient())}><Plus size={16}/> Nuevo paciente</button>
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
            <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Buscar nombre, DNI, centro, diagnóstico o status"/>
          </label>
        </header>

        {err && <div className="error">Error: {err}</div>}

        <div className="activeFilter">
          Vista actual: <strong>{filter}</strong>
          {filter !== 'Internados' && <button onClick={()=>setFilter('Internados')}><X size={14}/> Volver a internados</button>}
        </div>

        <section className="stats">
          <Card active={filter==='Internados'} onClick={()=>chooseFilter('Internados')} icon={<Users/>} n={stats.internados} t="Internados"/>
          <Card active={filter==='ARM'} onClick={()=>chooseFilter('ARM')} icon={<HeartPulse/>} n={stats.arm} t="ARM"/>
          <Card active={filter==='Vasoactivos'} onClick={()=>chooseFilter('Vasoactivos')} icon={<HeartPulse/>} n={stats.vaso} t="Vasoactivos"/>
          <Card active={filter==='TRR/NR'} onClick={()=>chooseFilter('TRR/NR')} icon={<Activity/>} n={stats.trr} t="TRR/NR"/>
          <Card active={filter==='Muerte'} onClick={()=>chooseFilter('Muerte')} icon={<AlertTriangle/>} n={stats.muerte} t="Muerte"/>
          <Card active={filter==='Todos'} onClick={()=>chooseFilter('Todos')} icon={<Activity/>} n={stats.total} t="Todos"/>
        </section>

        <section className="grid">
          <div>
            {filtered.map(p =>
              <article key={p.id} onClick={()=>setSel(p)} className={sel?.id===p.id?'patient selected':'patient'}>
                <div className="patientTop">
                  <h3>{p.name || 'Sin nombre'}</h3>
                  <button onClick={(e)=>{e.stopPropagation(); setEditing(p)}}><Pencil size={15}/> Editar</button>
                </div>
                <p>{p.centro} · {p.edad || '—'} años · día {days(p.fi)}</p>
                <b>{p.dx || p.dxs || 'Sin diagnóstico cargado'}</b>
                <div>
                  {p.status && <span>{p.status}</span>}
                  {isARM(p) && <span>ARM</span>}
                  {isVaso(p) && <span>Vaso</span>}
                  {isTRR(p) && <span>TRR</span>}
                  {isMuerte(p) && <span>Muerte</span>}
                </div>
              </article>
            )}
          </div>
          <Detail p={sel} onEdit={()=>sel && setEditing(sel)} onAlta={()=>sel && quickStatus(sel, 'Alta')} onMuerte={()=>sel && quickStatus(sel, 'Fallecido')}/>
        </section>
      </main>

      {editing && <EditModal patient={editing} onClose={()=>setEditing(null)} onSave={savePatient} saving={saving}/>}
    </div>
  );
}

function Card({icon,n,t,onClick,active}){
  return <button className={active ? 'card activeCard' : 'card'} onClick={onClick}>{icon}<strong>{n}</strong><span>{t}</span></button>;
}

function Row({k,v}){return <><dt>{k}</dt><dd>{v || '—'}</dd></>}

function Detail({p,onEdit,onAlta,onMuerte}){
  if(!p) return <section className="detail">Seleccione un paciente</section>;
  return (
    <section className="detail">
      <div className="detailHeader">
        <div>
          <h2>{p.name}</h2>
          <p className="muted">{p.centro} · DNI {p.dni || '—'} · Status {p.status || '—'}</p>
        </div>
        <button onClick={onEdit}><Pencil size={16}/> Editar</button>
      </div>
      <div className="actions">
        <button onClick={onAlta}>Dar alta</button>
        <button className="danger" onClick={onMuerte}>Fallecido</button>
      </div>
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

function EditModal({patient,onClose,onSave,saving}){
  const [form,setForm] = useState(patient);
  const set = (k,v) => setForm(prev => ({...prev, [k]: v}));

  return (
    <div className="modalBg">
      <form className="modal" onSubmit={(e)=>{e.preventDefault(); onSave(form)}}>
        <div className="modalHeader">
          <h2>{form.id ? 'Editar paciente' : 'Nuevo paciente'}</h2>
          <button type="button" onClick={onClose}><X size={18}/></button>
        </div>

        <div className="formGrid">
          <Input label="Nombre" value={form.name} onChange={v=>set('name',v)}/>
          <Input label="DNI" value={form.dni} onChange={v=>set('dni',v)}/>
          <Input label="Centro" value={form.centro} onChange={v=>set('centro',v)}/>
          <Input label="Fecha ingreso" type="date" value={form.fi} onChange={v=>set('fi',v)}/>
          <Input label="Edad" value={form.edad} onChange={v=>set('edad',v)}/>
          <Input label="Sexo" value={form.sexo} onChange={v=>set('sexo',v)}/>
          <Input label="Tipo" value={form.tipo} onChange={v=>set('tipo',v)}/>
          <Input label="Status" value={form.status} onChange={v=>set('status',v)} placeholder="In progress / Alta / Fallecido"/>
          <Textarea label="Dx inicial" value={form.dx} onChange={v=>set('dx',v)}/>
          <Textarea label="Dx final" value={form.dxf} onChange={v=>set('dxf',v)}/>
          <Textarea label="Dxs" value={form.dxs} onChange={v=>set('dxs',v)}/>
          <Textarea label="Enfermedad actual / evolución" value={form.enf} onChange={v=>set('enf',v)}/>
          <Textarea label="Asistencia respiratoria" value={form.resp} onChange={v=>set('resp',v)}/>
          <Textarea label="Vasoactivos" value={form.vaso} onChange={v=>set('vaso',v)}/>
          <Textarea label="NR / TRR" value={form.renal} onChange={v=>set('renal',v)}/>
          <Textarea label="ATB" value={form.atb} onChange={v=>set('atb',v)}/>
        </div>

        <div className="modalFooter">
          <button type="button" onClick={onClose}>Cancelar</button>
          <button className="save" type="submit" disabled={saving}><Save size={16}/>{saving ? 'Guardando...' : 'Guardar en Airtable'}</button>
        </div>
      </form>
    </div>
  );
}

function Input({label,value,onChange,type='text',placeholder=''}) {
  return <div className="field"><span>{label}</span><input type={type} value={value || ''} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/></div>
}

function Textarea({label,value,onChange}) {
  return <div className="field wide"><span>{label}</span><textarea value={value || ''} onChange={e=>onChange(e.target.value)}/></div>
}

createRoot(document.getElementById('root')).render(<App/>);
