export async function handler(event) {
  const headers = { 'Content-Type': 'application/json' };

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Método no permitido' }) };
  }

  const token = process.env.AIRTABLE_TOKEN;
  const baseId = process.env.AIRTABLE_BASE_ID;
  const table = process.env.AIRTABLE_TABLE_NAME || 'Table 1';

  if (!token || !baseId) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Faltan variables AIRTABLE_TOKEN o AIRTABLE_BASE_ID' }) };
  }

  try {
    const payload = JSON.parse(event.body || '{}');
    const { fields } = payload;

    if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Faltan fields válidos' }) };
    }

    const url = `https://api.airtable.com/v0/${baseId}/${encodeURIComponent(table)}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ fields, typecast: true })
    });

    const data = await response.json();
    if (!response.ok) return { statusCode: response.status, headers, body: JSON.stringify(data) };

    return { statusCode: 201, headers, body: JSON.stringify(data) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message }) };
  }
}
