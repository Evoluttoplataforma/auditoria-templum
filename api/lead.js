const PIPEDRIVE_API_TOKEN = process.env.PIPEDRIVE_API_TOKEN;
const PIPEDRIVE_BASE = 'https://api.pipedrive.com/v1';
const PIPELINE_ID = 1;   // INBOUND
const STAGE_ID = 218;    // NOVO LEAD
const OWNER_ID = 13840454; // Tatiana Sanches

// Pipedrive custom field keys for deal
const DEAL_FIELDS = {
  utm_source:       '92f5fbfb2cfdcbe4d46a72b5acf06ca15f29ac14',
  utm_medium:       '15bdeb9558dc89ed77d92cbfa0d04a4ee26d4d1f',
  utm_campaign:     '6b578f95362c28ee95473982525671ff43435b38',
  utm_term:         '5c22fd65ac5f7dbfbef6c07347fde9154bcdc385',
  utm_content:      '921482eae8dae5a8b2c830100038a17801df8b45',
  gclid:            '9aeff85ea6f6fe1bedbe6e67cfd5eb612a7257ab',
  gbraid:           '1deef181ac498bd3719c72ce8550caeefba31a0b',
  wbraid:           '4368ee92ce59d0a877ff6469bc112806ca1c2b23',
  fbclid:           '143f49947826ce1d1b3e995baa842e96de518e74',
  ttclid:           'ff6bb10f4d8c2e7d4587d07bd4dd3cc85aee2bc0',
  msclkid:          '0b7b86f5b1cee3f89394f6ed27e60d017a3b0de2',
  session_id:       '43091e3081136004843998d26c80abe6a7cb78b0',
  session_attributes_encoded: '9b271e5ddba2c2ed22d9ea9612c802006f1e4fff',
  gad_source:       '16cadd6acb21432129c344bfc2b4f34dbd7deec9',
  gad_campaignid:   '9a4fcacaff9851ca9ccf83980210b1644a0d1e04',
  norma_qual:       '5d8c568ce2263e4d8d69088b6ea8e68b850c3d23',
  norma_produto:    '88b449e175d73d74792f6f1b54f7724c5d4ae2c9',
  quiz_score:       '9284e4453a1982f16a9b30c142b60de81ee4ac57',
  page_url:         '07906bcd14ccd44498b73764da239193ace8f992',
  page_path:        '79a54756633069b9f0a508f6869780c6c2b52be2',
  // First-touch UTMs
  ft_utm_source:    '06754c74401e609e506d01d3a928f8d3025ad43e',
  ft_utm_medium:    'a335961b5cded844362e09480b5ca68048e33404',
  ft_utm_campaign:  '6bc82d18de3ae4574c4f8b8185a1dfa7e43cd5d0',
  ft_utm_content:   'ba178b2651759509012cfad3beac506f51d12a27',
  ft_utm_term:      '3ba67d7950d346b4b6dd0d4bbb8974a007a53aee',
};

async function pipedrive(method, path, body) {
  const url = `${PIPEDRIVE_BASE}${path}${path.includes('?') ? '&' : '?'}api_token=${PIPEDRIVE_API_TOKEN}`;
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  return res.json();
}

// Search person by email
async function findPersonByEmail(email) {
  const res = await pipedrive('GET', `/persons/search?term=${encodeURIComponent(email)}&fields=email&limit=1`);
  if (res.success && res.data && res.data.items && res.data.items.length > 0) {
    return res.data.items[0].item;
  }
  return null;
}

// Create organization
async function createOrganization(name) {
  const res = await pipedrive('POST', '/organizations', { name });
  if (res.success) return res.data;
  return null;
}

// Create person
async function createPerson(name, email, phone, orgId) {
  const body = {
    name,
    email: [{ value: email, primary: true }],
    phone: [{ value: phone, primary: true }],
  };
  if (orgId) body.org_id = orgId;
  const res = await pipedrive('POST', '/persons', body);
  if (res.success) return res.data;
  return null;
}

// Update person (link to org if needed)
async function updatePerson(personId, orgId) {
  const res = await pipedrive('PUT', `/persons/${personId}`, { org_id: orgId });
  if (res.success) return res.data;
  return null;
}

// Create deal with custom fields
async function createDeal(title, personId, orgId, customFields) {
  const body = {
    title,
    person_id: personId,
    org_id: orgId,
    user_id: OWNER_ID,
    pipeline_id: PIPELINE_ID,
    stage_id: STAGE_ID,
    ...customFields,
  };
  const res = await pipedrive('POST', '/deals', body);
  if (res.success) return res.data;
  return null;
}

// Create note on deal
async function createNote(dealId, htmlContent) {
  const res = await pipedrive('POST', '/notes', {
    deal_id: dealId,
    user_id: OWNER_ID,
    content: htmlContent,
    pinned_to_deal_flag: 1,
  });
  if (res.success) return res.data;
  return null;
}

// Build Raio-X HTML note
function buildRaioXNote(data) {
  const score = data.quiz_score || 0;
  const level = data.quiz_level || 'Não informado';
  const answers = data.quiz_answers || [];
  const norma = data.norma || '';
  const submittedAt = data.submitted_at || new Date().toISOString();

  let riskColor, riskBg;
  if (score <= 30) { riskColor = '#22c55e'; riskBg = '#f0fdf4'; }
  else if (score <= 60) { riskColor = '#eab308'; riskBg = '#fefce8'; }
  else { riskColor = '#ef4444'; riskBg = '#fef2f2'; }

  // Build answers table rows
  let answersRows = '';
  answers.forEach((a, i) => {
    let statusColor, statusLabel;
    if (a.points <= 3) { statusColor = '#16a34a'; statusLabel = 'OK'; }
    else if (a.points <= 6) { statusColor = '#ca8a04'; statusLabel = 'Atenção'; }
    else { statusColor = '#dc2626'; statusLabel = 'Crítico'; }

    answersRows += `<tr>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${a.question || ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;">${a.answer || ''}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;text-align:center;">${a.points}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #e5e7eb;color:${statusColor};font-weight:bold;">${statusLabel}</td>
    </tr>`;
  });

  // Top 3 critical risks
  const criticalRisks = [...answers]
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
    .filter(a => a.points > 3);

  let risksHtml = '';
  if (criticalRisks.length > 0) {
    risksHtml = '<h3 style="margin-top:16px;">Top Riscos Críticos</h3><ol>';
    criticalRisks.forEach(r => {
      risksHtml += `<li><strong>${r.question || ''}</strong> — ${r.answer || ''} (${r.points} pts)</li>`;
    });
    risksHtml += '</ol>';
  }

  const dateFormatted = new Date(submittedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

  return `<h2>Raio-X Diagnóstico — ${norma || 'Auditoria ISO'}</h2>
<p><strong>Data:</strong> ${dateFormatted}</p>
<p style="padding:8px 12px;background:${riskBg};border-left:4px solid ${riskColor};font-size:16px;">
  <strong>Score Total: ${score}/100</strong> — Nível: <strong>${level}</strong>
</p>

<h3>Respostas do Diagnóstico</h3>
<table style="width:100%;border-collapse:collapse;font-size:13px;">
  <thead>
    <tr style="background:#f3f4f6;">
      <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #d1d5db;">#</th>
      <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #d1d5db;">Pergunta</th>
      <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #d1d5db;">Resposta</th>
      <th style="padding:6px 8px;text-align:center;border-bottom:2px solid #d1d5db;">Pts</th>
      <th style="padding:6px 8px;text-align:left;border-bottom:2px solid #d1d5db;">Status</th>
    </tr>
  </thead>
  <tbody>
    ${answersRows}
  </tbody>
</table>

${risksHtml}

<hr style="margin-top:16px;">
<p style="font-size:11px;color:#9ca3af;">Lead capturado via LP Auditoria ISO | ${data.page_url || ''}</p>`;
}

// Map form payload to Pipedrive deal custom fields
function mapDealCustomFields(data) {
  const fields = {};

  // Last-touch UTMs
  if (data.utm_source) fields[DEAL_FIELDS.utm_source] = data.utm_source;
  if (data.utm_medium) fields[DEAL_FIELDS.utm_medium] = data.utm_medium;
  if (data.utm_campaign) fields[DEAL_FIELDS.utm_campaign] = data.utm_campaign;
  if (data.utm_term) fields[DEAL_FIELDS.utm_term] = data.utm_term;
  if (data.utm_content) fields[DEAL_FIELDS.utm_content] = data.utm_content;

  // Click IDs
  if (data.gclid) fields[DEAL_FIELDS.gclid] = data.gclid;
  if (data.gbraid) fields[DEAL_FIELDS.gbraid] = data.gbraid;
  if (data.wbraid) fields[DEAL_FIELDS.wbraid] = data.wbraid;
  if (data.fbclid) fields[DEAL_FIELDS.fbclid] = data.fbclid;
  if (data.ttclid) fields[DEAL_FIELDS.ttclid] = data.ttclid;
  if (data.msclkid) fields[DEAL_FIELDS.msclkid] = data.msclkid;

  // Session / tracking
  if (data.session_id) fields[DEAL_FIELDS.session_id] = data.session_id;
  if (data.session_attributes_encoded) fields[DEAL_FIELDS.session_attributes_encoded] = data.session_attributes_encoded;
  if (data.gad_source) fields[DEAL_FIELDS.gad_source] = data.gad_source;
  if (data.gad_campaignid) fields[DEAL_FIELDS.gad_campaignid] = data.gad_campaignid;

  // Norma (goes to both fields)
  if (data.norma) {
    fields[DEAL_FIELDS.norma_qual] = data.norma;
    fields[DEAL_FIELDS.norma_produto] = data.norma;
  }

  // Quiz score
  if (data.quiz_score !== undefined && data.quiz_score !== null) {
    fields[DEAL_FIELDS.quiz_score] = String(data.quiz_score);
  }

  // Page info
  if (data.page_url) fields[DEAL_FIELDS.page_url] = data.page_url;
  if (data.page_path) fields[DEAL_FIELDS.page_path] = data.page_path;

  // First-touch UTMs (same values as last-touch for now)
  if (data.utm_source) fields[DEAL_FIELDS.ft_utm_source] = data.utm_source;
  if (data.utm_medium) fields[DEAL_FIELDS.ft_utm_medium] = data.utm_medium;
  if (data.utm_campaign) fields[DEAL_FIELDS.ft_utm_campaign] = data.utm_campaign;
  if (data.utm_content) fields[DEAL_FIELDS.ft_utm_content] = data.utm_content;
  if (data.utm_term) fields[DEAL_FIELDS.ft_utm_term] = data.utm_term;

  return fields;
}

module.exports = async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!PIPEDRIVE_API_TOKEN) {
    console.error('PIPEDRIVE_API_TOKEN not configured');
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  try {
    const data = req.body;

    const name = [data.first_name, data.last_name].filter(Boolean).join(' ') || data.name || 'Lead LP';
    const email = data.email || '';
    const phone = data.phone || '';
    const company = data.company || '';
    const norma = data.norma || '';

    // 1. Search for existing person by email
    let person = null;
    if (email) {
      person = await findPersonByEmail(email);
    }

    // 2. Create organization
    let org = null;
    if (company) {
      org = await createOrganization(company);
    }
    const orgId = org ? org.id : null;

    // 3. Create or update person
    let personId;
    if (person) {
      personId = person.id;
      // Link to org if not already linked
      if (orgId) {
        await updatePerson(personId, orgId);
      }
    } else {
      const newPerson = await createPerson(name, email, phone, orgId);
      personId = newPerson ? newPerson.id : null;
    }

    // 4. Create deal
    const dealTitle = `[LP Auditoria] ${norma || 'ISO'} — ${name}`;
    const customFields = mapDealCustomFields(data);
    const deal = await createDeal(dealTitle, personId, orgId, customFields);

    // 5. Create Raio-X note if quiz data exists
    if (deal && data.quiz_answers && data.quiz_answers.length > 0) {
      const noteHtml = buildRaioXNote(data);
      await createNote(deal.id, noteHtml);
    }

    return res.status(200).json({ success: true, deal_id: deal ? deal.id : null });
  } catch (err) {
    console.error('Error creating lead in Pipedrive:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
