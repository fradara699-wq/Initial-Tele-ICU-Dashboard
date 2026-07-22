import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, AlertTriangle, HeartPulse, Pencil, Plus, Save, Search, Stethoscope, UserCheck, Users, X } from 'lucide-react';
import './styles.css';

const findField = (fields, names) => {
  const key = names.find(name => fields?.[name] !== undefined && fields?.[name] !== null);
  return { key: key || names[0], value: key ? fields[key] : '' };
};
const txt = value => String(value || '').toLowerCase().trim();
const yes = value => ['si', 'sí', 'yes', 'true', '1', 'x'].includes(txt(value));
const days = date => {
  if (!date) return '—';
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return '—';
  return Math.max(1, Math.ceil((Date.now() - parsed.getTime()) / 86400000));
};

const FIELD_OPTIONS = {
  name: ['Name', 'Nombre', 'Paciente'],
  dni: ['DNI', 'Documento'],
  centro: ['Centro', 'CENTRO', 'Institución', 'Institucion'],
  fi: ['FI', 'Fecha ingreso', 'Fecha de ingreso'],
  dx: ['Dx inicial', 'Diagnóstico inicial', 'Diagnostico inicial'],
  dxf: ['Dx final', 'Diagnóstico final', 'Diagnostico final'],
  dxs: ['Dxs', 'Diagnósticos asociados', 'Diagnosticos asociados'],
  edad: ['Edad', 'age'],
  sexo: ['Sexo', 'sex'],
  enf: ['enfermedad actual', 'Enfermedad actual', 'Evolución', 'Evolucion'],
  resp: ['Asistencia respiratoria', 'ARM', 'Resp'],
  vaso: ['Vasoactivos', 'Vaso', 'Vasopresores'],
  renal: ['NR', 'TRR', 'Terapia de reemplazo renal', 'Renal'],
  atb: ['ATB', 'Antibióticos', 'Antibioticos'],
  status: ['Status', 'Estado', 'Internado', 'Activo'],
  muerte: ['Muerte']
};

function norm(record) {
  const fields = record.fields || {};
  const normalized = { id: record.id, fieldKeys: {} };

  Object.entries(FIELD_OPTIONS).forEach(([property, names]) => {
    const match = findField(fields, names);
    normalized[property] = match.value;
    normalized.fieldKeys[property] = match.key;
  });

  normalized.centro = normalized.centro || 'Sin centro';
  return normalized;
}

const isMuerte = patient => yes(patient.muerte) || txt(patient.status).includes('falle') || txt(patient.status).includes('muerte');
const isEgresado = patient => ['alta', 'egreso', 'egresado', 'derivado', 'fallecido', 'muerte', 'óbito', 'obito'].some(word => txt(patient.status).includes(word));
const isInternado = patient => {
  const status = txt(patient.status);
  if (status.includes('in progress')) return true;
  if (isMuerte(patient) || isEgresado(patient)) return false;
  return ['internado', 'internada', 'activo', 'activa', 'actual', 'hospitalizado', 'uti', 'ucc'].some(word => status.includes(word));
};
const isARM = patient => yes(patient.resp) || txt(patient.resp).includes('arm') || txt(patient.resp).includes('invasiva');
const isVaso = patient => yes(patient.vaso) || String(patient.vaso || '').trim().length > 1;
const isTRR = patient => yes(patient.renal) || String(patient.renal || '').trim().length > 1;

function App() {
  const [records, setRecords] = useState([]);
  const [q, setQ] = useState('');
  const [centro, setCentro] = useState('Todos');
  const [filter, setFilter] = useState('Internados');
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const loadPatients = async (selectedId = null) => {
    setLoading(true);
    setErr('');
    try {
      const response = await fetch('/.netlify/functions/patients', { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'No se pudieron cargar los pacientes');
      const patients = data.map(norm);
      setRecords(patients);
      setSel(current => {
        const id = selectedId || current?.id;
        return patients.find(patient => patient.id === id) || patients.find(isInternado) || patients[0] || null;
      });
    } catch (error) {
      setErr(error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPatients();
  }, []);

  const centros = useMemo(() => ['Todos', ...new Set(records.map(patient => patient.centro).filter(Boolean))], [records]);

  const base = records.filter(patient =>
    (centro === 'Todos' || patient.centro === centro) &&
    [patient.name, patient.dni, patient.centro, patient.dx, patient.dxf, patient.dxs, patient.enf, patient.status]
      .join(' ')
      .toLowerCase()
      .includes(q.toLowerCase())
  );

  const filtered = base.filter(patient => {
    if (filter === 'Internados') return isInternado(patient);
    if (filter === 'ARM') return isInternado(patient) && isARM(patient);
    if (filter === 'Vasoactivos') return isInternado(patient) && isVaso(patient);
    if (filter === 'TRR/NR') return isInternado(patient) && isTRR(patient);
    if (filter === 'Muerte') return isMuerte(patient);
    return true;
  });

  const stats = {
    total: base.length,
    internados: base.filter(isInternado).length,
    arm: base.filter(patient => isInternado(patient) && isARM(patient)).length,
    vaso: base.filter(patient => isInternado(patient) && isVaso(patient)).length,
    trr: base.filter(patient => isInternado(patient) && isTRR(patient)).length,
    muerte: base.filter(isMuerte).length
  };

  const chooseFilter = next => setFilter(previous => previous === next ? 'Internados' : next);

  return (
    <div className="app">
      <aside>
        <h1>Tele ICU<br />Dashboard</h1>
        <p>Panel operativo conectado a Airtable</p>
        {centros.map(item => (
          <button key={item} className={centro === item ? 'active' : ''} onClick={() => setCentro(item)}>
            <Stethoscope size={16} />{item}
          </button>
        ))}
      </aside>

      <main>
        <header>
          <div>
            <h2>Pacientes Tele-ICU</h2>
            <span>{loading ? 'Cargando...' : `${filtered.length} pacientes visibles`}</span>
          </div>
          <div className="headerActions">
            <button className="newPatientButton" onClick={() => setCreating(true)}><Plus size={18} /> Nuevo paciente</button>
            <label className="searchBox">
              <Search size={18} />
              <input value={q} onChange={event => setQ(event.target.value)} placeholder="Buscar nombre, DNI, centro, diagnóstico o status" />
            </label>
          </div>
        </header>

        {err && <div className="error">Error Airtable: {err}</div>}

        <div className="activeFilter">
          Vista actual: <strong>{filter}</strong>
          {filter !== 'Internados' && <button onClick={() => setFilter('Internados')}><X size={14} /> Volver a internados</button>}
        </div>

        <section className="stats">
          <Card active={filter === 'Internados'} onClick={() => chooseFilter('Internados')} icon={<Users />} n={stats.internados} t="Internados" />
          <Card active={filter === 'ARM'} onClick={() => chooseFilter('ARM')} icon={<HeartPulse />} n={stats.arm} t="ARM" />
          <Card active={filter === 'Vasoactivos'} onClick={() => chooseFilter('Vasoactivos')} icon={<HeartPulse />} n={stats.vaso} t="Vasoactivos" />
          <Card active={filter === 'TRR/NR'} onClick={() => chooseFilter('TRR/NR')} icon={<Activity />} n={stats.trr} t="TRR/NR" />
          <Card active={filter === 'Muerte'} onClick={() => chooseFilter('Muerte')} icon={<AlertTriangle />} n={stats.muerte} t="Muerte" />
          <Card active={filter === 'Todos'} onClick={() => chooseFilter('Todos')} icon={<Activity />} n={stats.total} t="Todos" />
        </section>

        <section className="grid">
          <div>
            {filtered.map(patient => (
              <article key={patient.id} onClick={() => setSel(patient)} className={sel?.id === patient.id ? 'patient selected' : 'patient'}>
                <h3>{patient.name || 'Sin nombre'}</h3>
                <p>{patient.centro} · {patient.edad || '—'} años · día {days(patient.fi)}</p>
                <b>{patient.dx || patient.dxs || 'Sin diagnóstico cargado'}</b>
                <div>
                  {patient.status && <span>{patient.status}</span>}
                  {isARM(patient) && <span>ARM</span>}
                  {isVaso(patient) && <span>Vaso</span>}
                  {isTRR(patient) && <span>TRR</span>}
                  {isMuerte(patient) && <span>Muerte</span>}
                </div>
              </article>
            ))}
          </div>
          <Detail patient={sel} onSaved={loadPatients} />
        </section>
      </main>
      {creating && <NewPatientModal records={records} onClose={() => setCreating(false)} onCreated={async id => { setCreating(false); setFilter('Internados'); await loadPatients(id); }} />}
    </div>
  );
}

function Card({ icon, n, t, onClick, active }) {
  return <button className={active ? 'card activeCard' : 'card'} onClick={onClick}>{icon}<strong>{n}</strong><span>{t}</span></button>;
}

function Row({ label, value }) {
  return <><dt>{label}</dt><dd>{value || '—'}</dd></>;
}

const EDIT_FIELDS = [
  ['name', 'Nombre'], ['dni', 'DNI'], ['edad', 'Edad'], ['sexo', 'Sexo'],
  ['centro', 'Centro'], ['fi', 'Fecha ingreso'], ['status', 'Status'],
  ['dx', 'Diagnóstico inicial'], ['dxf', 'Diagnóstico final'], ['dxs', 'Diagnósticos asociados'],
  ['resp', 'Asistencia respiratoria'], ['vaso', 'Vasoactivos'], ['renal', 'NR / TRR'], ['atb', 'ATB'],
  ['enf', 'Enfermedad actual / evolución']
];


const DEFAULT_FIELD_KEYS = {
  name: 'Name', dni: 'DNI', edad: 'Edad', sexo: 'Sexo', centro: 'Centro', fi: 'FI',
  status: 'Status', dx: 'Dx inicial', dxf: 'Dx final', dxs: 'Dxs', enf: 'enfermedad actual',
  resp: 'Asistencia respiratoria', vaso: 'Vasoactivos', renal: 'NR', atb: 'ATB'
};

function NewPatientModal({ records, onClose, onCreated }) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState({
    name: '', dni: '', edad: '', sexo: '', centro: '', fi: today,
    dx: '', dxf: '', dxs: '', resp: '', vaso: '', renal: '', atb: '', enf: ''
  });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fieldKeys = records[0]?.fieldKeys || DEFAULT_FIELD_KEYS;

  const create = async () => {
    if (!String(form.name || '').trim()) {
      setMessage('Error: cargá el nombre del paciente');
      return;
    }
    setSaving(true);
    setMessage('');
    try {
      const fields = {};
      Object.entries(form).forEach(([key, value]) => {
        const airtableField = fieldKeys[key] || DEFAULT_FIELD_KEYS[key];
        if (airtableField && value !== '') fields[airtableField] = value;
      });
      fields[fieldKeys.status || DEFAULT_FIELD_KEYS.status] = 'In Progress';

      const response = await fetch('/.netlify/functions/createPatient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields })
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'No se pudo crear el paciente');
      await onCreated(data.id);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modalBackdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="modalCard">
        <div className="detailHeader">
          <div><h2>Nuevo paciente</h2><p className="muted">Se guardará como <strong>In Progress</strong></p></div>
          <button className="iconButton" onClick={onClose}><X size={20} /></button>
        </div>
        {message && <div className="saveMessage errorMessage">{message}</div>}
        <div className="editForm">
          {EDIT_FIELDS.filter(([key]) => key !== 'status').map(([key, label]) => {
            const multiline = ['dx', 'dxf', 'dxs', 'enf'].includes(key);
            return (
              <label className={multiline ? 'field fullWidth' : 'field'} key={key}>
                <span>{label}{key === 'name' ? ' *' : ''}</span>
                {multiline ? (
                  <textarea value={form[key] ?? ''} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} rows={key === 'enf' ? 5 : 3} />
                ) : (
                  <input type={key === 'fi' ? 'date' : 'text'} value={form[key] ?? ''} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />
                )}
              </label>
            );
          })}
          <div className="formActions fullWidth">
            <button className="cancelButton" disabled={saving} onClick={onClose}><X size={17} /> Cancelar</button>
            <button className="saveButton" disabled={saving} onClick={create}><Save size={17} /> {saving ? 'Guardando...' : 'Crear paciente'}</button>
          </div>
        </div>
      </section>
    </div>
  );
}

function Detail({ patient, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setEditing(false);
    setMessage('');
    if (patient) {
      const initial = {};
      EDIT_FIELDS.forEach(([key]) => { initial[key] = patient[key] ?? ''; });
      setForm(initial);
    }
  }, [patient?.id]);

  if (!patient) return <section className="detail">Seleccione un paciente</section>;

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const fields = {};
      EDIT_FIELDS.forEach(([key]) => {
        const airtableField = patient.fieldKeys[key];
        if (airtableField) fields[airtableField] = form[key] ?? '';
      });

      const response = await fetch('/.netlify/functions/updatePatient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: patient.id, fields })
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'No se pudieron guardar los cambios');
      setMessage('Cambios guardados correctamente');
      setEditing(false);
      await onSaved(patient.id);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  const discharge = async () => {
    if (!window.confirm(`¿Está seguro de dar de alta a ${patient.name || 'este paciente'}?`)) return;
    setSaving(true);
    setMessage('');
    try {
      const statusField = patient.fieldKeys.status || 'Status';
      const response = await fetch('/.netlify/functions/updatePatient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: patient.id, fields: { [statusField]: 'Discharged' } })
      });
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'No se pudo dar de alta');
      setMessage('Paciente dado de alta correctamente');
      await onSaved('__select_first_active__');
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="detail">
      <div className="detailHeader">
        <div>
          <h2>{patient.name}</h2>
          <p className="muted">{patient.centro} · DNI {patient.dni || '—'} · Status {patient.status || '—'}</p>
        </div>
        {!editing && <div className="detailButtons">
          {isInternado(patient) && <button className="dischargeButton" disabled={saving} onClick={discharge}><UserCheck size={17} /> Dar de alta</button>}
          <button className="editButton" onClick={() => setEditing(true)}><Pencil size={17} /> Editar</button>
        </div>}
      </div>

      {message && <div className={message.startsWith('Error') ? 'saveMessage errorMessage' : 'saveMessage'}>{message}</div>}

      {editing ? (
        <div className="editForm">
          {EDIT_FIELDS.map(([key, label]) => {
            const multiline = ['dx', 'dxf', 'dxs', 'enf'].includes(key);
            return (
              <label className={multiline ? 'field fullWidth' : 'field'} key={key}>
                <span>{label}</span>
                {multiline ? (
                  <textarea value={form[key] ?? ''} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} rows={key === 'enf' ? 6 : 3} />
                ) : (
                  <input type={key === 'fi' ? 'date' : 'text'} value={form[key] ?? ''} onChange={event => setForm(current => ({ ...current, [key]: event.target.value }))} />
                )}
              </label>
            );
          })}
          <div className="formActions fullWidth">
            <button className="cancelButton" disabled={saving} onClick={() => setEditing(false)}><X size={17} /> Cancelar</button>
            <button className="saveButton" disabled={saving} onClick={save}><Save size={17} /> {saving ? 'Guardando...' : 'Guardar cambios'}</button>
          </div>
        </div>
      ) : (
        <dl>
          <Row label="Edad / Sexo" value={`${patient.edad || '—'} / ${patient.sexo || '—'}`} />
          <Row label="Fecha ingreso" value={`${patient.fi || '—'} · día ${days(patient.fi)}`} />
          <Row label="Diagnóstico inicial" value={patient.dx} />
          <Row label="Dx final" value={patient.dxf} />
          <Row label="Diagnósticos asociados" value={patient.dxs} />
          <Row label="Asistencia respiratoria" value={patient.resp} />
          <Row label="Vasoactivos" value={patient.vaso} />
          <Row label="NR / TRR" value={patient.renal} />
          <Row label="ATB" value={patient.atb} />
          <Row label="Enfermedad actual / evolución" value={patient.enf} />
        </dl>
      )}
    </section>
  );
}

createRoot(document.getElementById('root')).render(<App />);
