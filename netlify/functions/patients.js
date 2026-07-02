export async function handler() {
  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || 'Table 1';
  if (!token || !baseId) return { statusCode: 500, body: JSON.stringify({ error: 'Faltan variables AIRTABLE_TOKEN o AIRTABLE_BASE_ID' }) };
  const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}?pageSize=100`;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }});
    const data = await res.json();
    if (!res.ok) return { statusCode: res.status, body: JSON.stringify(data) };
    return { statusCode: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data.records || []) };
  } catch (e) { return { statusCode: 500, body: JSON.stringify({ error: e.message }) }; }
}
