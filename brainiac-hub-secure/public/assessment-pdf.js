// Uniform branded Assessment Report PDF generator for Beruntung Brainiac (jsPDF).

function formatPdfDate(iso) {
 if (!iso) return '—';
 const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
 if (!m) return String(iso);
 const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
 const mon = months[Number(m[2]) - 1];
 return mon ? `${Number(m[3])} ${mon} ${m[1]}` : iso;
}

function formatPdfAge(dob, date) {
 if (!dob || !date || dob > date) return '—';
 const a = new Date(dob + 'T00:00:00Z'), b = new Date(date + 'T00:00:00Z');
 if (!Number.isFinite(+a) || !Number.isFinite(+b)) return '—';
 let months = (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + b.getUTCMonth() - a.getUTCMonth();
 if (b.getUTCDate() < a.getUTCDate()) months--;
 const y = Math.floor(months / 12), m = months % 12;
 return m ? `${y} years ${m} months` : `${y} years`;
}

function createAssessmentPdf(a, PDF, fonts, logo = null) {
 const doc = new PDF({ unit: 'mm', format: 'a4', compress: true, putOnlyUsedFonts: true });
 doc.addFileToVFS('NotoSans-Regular.ttf', fonts.regular);
 doc.addFont('NotoSans-Regular.ttf', 'NotoSans', 'normal');
 doc.addFileToVFS('NotoSans-Bold.ttf', fonts.bold);
 doc.addFont('NotoSans-Bold.ttf', 'NotoSans', 'bold');

 const brand = (typeof brainiacBrand !== 'undefined' && brainiacBrand) ? brainiacBrand : {
  name: 'Beruntung Brainiac',
  owner: 'Beruntung Brainiac Enterprise',
  ssm: '202503030392 (003694359-M)',
  tagline: 'LEARN • PLAY • GROW',
  description: 'Pusat Terapi Perkembangan Kanak-Kanak'
 };

 const isDraft = a.status !== 'Lengkap';
 const type = a.type || 'speech';
 const reportTitle =
  type === 'ot-clinical' ? 'OCCUPATIONAL THERAPY ASSESSMENT REPORT' :
  type === 'ot-ssp' ? 'SHORT SENSORY PROFILE (SSP) REPORT' :
  type === 'ot-denver' ? 'DENVER II DEVELOPMENTAL SCREENING REPORT' :
  'SPEECH & LANGUAGE ASSESSMENT REPORT';

 const headerTag = isDraft ? 'DRAF / DRAFT · CLINICAL REPORT' : 'CLINICAL ASSESSMENT REPORT';

 doc.setProperties({
  title: `${reportTitle} — ${a.studentName || 'Client'}`,
  author: brand.name,
  subject: `${reportTitle} (${a.date || ''})`,
  creator: 'Brainiac Hub EHR'
 });

 // Brand palette
 const C = {
  navy: [0, 32, 63],
  blue: [0, 152, 219],
  yellow: [255, 210, 0],
  ink: [26, 42, 54],
  muted: [78, 96, 112],
  tint: [244, 248, 250],
  secBg: [236, 244, 248],
  border: [209, 222, 230],
  draftBg: [254, 247, 224],
  draftBorder: [224, 174, 42],
  draftInk: [122, 82, 0],
  red: [155, 44, 44],
  amber: [151, 90, 22],
  teal: [23, 108, 98]
 };

 const left = 18, right = 192, width = right - left, contentTop = 43, bottom = 272;
 let y = contentTop;

 const clean = v => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').trim();

 function drawHeader() {
  if (logo) {
   try {
    const info = doc.getImageProperties(logo);
    const w = 60, h = w * info.height / info.width;
    doc.addImage(logo, 'PNG', left, 7, w, Math.min(h, 24));
   } catch {
    doc.setFont('NotoSans', 'bold'); doc.setFontSize(14); doc.setTextColor(...C.navy);
    doc.text(brand.name.toUpperCase(), left, 16);
   }
  } else {
   doc.setFont('NotoSans', 'bold'); doc.setFontSize(14); doc.setTextColor(...C.navy);
   doc.text(brand.name.toUpperCase(), left, 16);
  }
  doc.setFont('NotoSans', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...C.navy);
  doc.text(headerTag, right, 12, { align: 'right' });
  doc.setFont('NotoSans', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.muted);
  doc.text(brand.description, right, 17.5, { align: 'right' });
  doc.setFontSize(7.5);
  doc.text(brand.owner, right, 22.5, { align: 'right' });
  doc.text('No. SSM: ' + brand.ssm, right, 27, { align: 'right' });
  // Signature dual brand accent rule (yellow + thin navy)
  doc.setDrawColor(...C.yellow); doc.setLineWidth(1.1); doc.line(left, 33, right, 33);
  doc.setDrawColor(...C.navy); doc.setLineWidth(0.25); doc.line(left, 34.4, right, 34.4);
  doc.setTextColor(...C.ink);
 }

 function drawFooter(pageNum, totalPages) {
  doc.setDrawColor(...C.border); doc.setLineWidth(0.25); doc.line(left, 279, right, 279);
  doc.setFont('NotoSans', 'bold'); doc.setFontSize(7); doc.setTextColor(...C.navy);
  doc.text(brand.tagline, left, 284);
  doc.setFont('NotoSans', 'normal'); doc.setTextColor(...C.muted);
  const statusTag = isDraft ? 'SULIT / CONFIDENTIAL · DRAF' : 'SULIT / CONFIDENTIAL';
  doc.text('  ·  ' + statusTag, left + doc.getTextWidth(brand.tagline), 284);
  doc.text(`Page ${pageNum} of ${totalPages}`, right, 284, { align: 'right' });
  doc.setFontSize(6.5);
  doc.text(`${brand.owner}  ·  No. SSM: ${brand.ssm}  ·  ${brand.description}`, left, 289);
 }

 function newPage() {
  doc.addPage();
  drawHeader();
  y = contentTop;
 }

 function ensure(h) {
  if (y + h > bottom) newPage();
 }

 function drawSectionHeader(num, titleEn, titleMs) {
  ensure(22);
  y += 2;
  doc.setFillColor(...C.secBg);
  doc.roundedRect(left, y, width, 8.2, 1.2, 1.2, 'F');
  // Left brand blue accent bar
  doc.setFillColor(...C.blue);
  doc.rect(left, y, 2.2, 8.2, 'F');
  doc.setFont('NotoSans', 'bold'); doc.setFontSize(9.5); doc.setTextColor(...C.navy);
  const label = `${String(num).padStart(2, '0')}  ·  ${titleEn.toUpperCase()}`;
  doc.text(label, left + 5, y + 5.4);
  if (titleMs && titleMs.toLowerCase() !== titleEn.toLowerCase()) {
   doc.setFont('NotoSans', 'normal'); doc.setFontSize(7.5); doc.setTextColor(...C.muted);
   doc.text(titleMs, right - 3, y + 5.3, { align: 'right' });
  }
  y += 13.0;
  doc.setTextColor(...C.ink);
 }

 function drawWrappedLines(text, opts = {}) {
  const { size = 9.2, bold = false, indent = 0, color = C.ink, lineHeight = 4.5, after = 1.6 } = opts;
  doc.setFont('NotoSans', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, width - indent);
  for (const line of lines) {
   if (y + lineHeight > bottom) {
    newPage();
    doc.setFont('NotoSans', bold ? 'bold' : 'normal');
    doc.setFontSize(size);
    doc.setTextColor(...color);
   }
   doc.text(line, left + indent, y);
   y += lineHeight;
  }
  y += after;
 }

 function drawSectionBody(rawText) {
  const text = clean(rawText);
  if (!text) {
   drawWrappedLines('Not recorded / Belum diisi.', { size: 8.8, color: C.muted, after: 2 });
   return;
  }
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const bulletMode = lines.length >= 3 && lines.every(l => l.length < 150) && !lines.some(l => /^[A-D]\.\s+/.test(l));

  for (const line of lines) {
   // Sub-headings like "A. Occupational Therapy Intervention"
   if (/^[A-Z]\.\s+/.test(line) && line.length < 95) {
    ensure(12);
    y += 1.5;
    drawWrappedLines(line, { size: 9.5, bold: true, color: C.navy, lineHeight: 4.6, after: 1.4 });
    continue;
   }
   // Key-value lines like "Recommended Frequency: ...", "Give Clear, Simple Instructions: ...", or "Dressing: ..."
   const kv = line.match(/^([A-Za-z][A-Za-z0-9 /&()"',-]{1,56}?):\s+(.+)$/);
   if (kv) {
    const label = kv[1] + ': ';
    const val = kv[2];
    const indent = 4.2;
    doc.setFont('NotoSans', 'bold'); doc.setFontSize(9.1);
    const labelW = doc.getTextWidth(label);
    if (labelW < 92) {
     ensure(5.5);
     doc.setFont('NotoSans', 'bold'); doc.setFontSize(9.1);
     doc.setTextColor(...C.blue);
     doc.text('•', left + 0.8, y);
     doc.setTextColor(...C.navy);
     doc.text(label, left + indent, y);
     doc.setFont('NotoSans', 'normal'); doc.setFontSize(9.1); doc.setTextColor(...C.ink);
     const firstAvail = width - indent - labelW;
     const firstLines = doc.splitTextToSize(val, firstAvail);
     doc.text(firstLines[0] || '', left + indent + labelW, y);
     y += 4.5;
     if (firstLines.length > 1) {
      const restText = val.slice((firstLines[0] || '').length).trim();
      if (restText) drawWrappedLines(restText, { size: 9.1, indent, lineHeight: 4.5, after: 1.4 });
     } else {
      y += 1.4;
     }
     continue;
    }
   }
   // Explicit bullet or short list item
   if (/^[•\-*]\s+/.test(line)) {
    const body = line.replace(/^[•\-*]\s+/, '');
    ensure(5);
    doc.setFont('NotoSans', 'bold'); doc.setFontSize(9.1); doc.setTextColor(...C.blue);
    doc.text('•', left + 0.8, y);
    drawWrappedLines(body, { size: 9.1, indent: 4.2, lineHeight: 4.5, after: 1.2 });
    continue;
   }
   if (bulletMode) {
    ensure(5);
    doc.setFont('NotoSans', 'bold'); doc.setFontSize(9.1); doc.setTextColor(...C.blue);
    doc.text('•', left + 0.8, y);
    drawWrappedLines(line, { size: 9.1, indent: 4.2, lineHeight: 4.5, after: 1.2 });
   } else {
    drawWrappedLines(line, { size: 9.2, indent: 0, lineHeight: 4.6, after: 2.0 });
   }
  }
 }

 function drawSspTable() {
  const domains = (typeof sspDomains !== 'undefined') ? sspDomains : [
   ['tactile', 'Sensitiviti sentuhan', 'Tactile Sensitivity'],
   ['tasteSmell', 'Sensitiviti rasa / bau', 'Taste/Smell Sensitivity'],
   ['movement', 'Sensitiviti pergerakan', 'Movement Sensitivity'],
   ['underresponsive', 'Kurang respons / mencari sensasi', 'Underresponsive/Seeks Sensation'],
   ['auditoryFiltering', 'Penapisan auditori', 'Auditory Filtering'],
   ['lowEnergy', 'Tenaga rendah / lemah', 'Low Energy/Weak'],
   ['visualAuditory', 'Sensitiviti visual / auditori', 'Visual/Auditory Sensitivity']
  ];
  const maxMap = (typeof sspMaxScores !== 'undefined') ? sspMaxScores : {
   tactile: 35, tasteSmell: 20, movement: 15, underresponsive: 35,
   auditoryFiltering: 30, lowEnergy: 30, visualAuditory: 25, sspTotal: 190
  };
  const rows = domains
   .filter(([k]) => (a[k + 'Score'] !== undefined && a[k + 'Score'] !== '') || a[k + 'Classification'])
   .map(([k, , en]) => ({
    domain: en,
    score: (a[k + 'Score'] !== undefined && a[k + 'Score'] !== '') ? `${a[k + 'Score']} / ${maxMap[k]}` : '—',
    classification: clean(a[k + 'Classification']) || '—'
   }));
  if (!rows.length && !a.sspTotal && !a.sspOverall) return;

  const col1 = 82, col2 = 30, col3 = width - col1 - col2;
  const rowH = 6.8;
  const needed = 14 + (rows.length + 1) * rowH;
  ensure(Math.min(needed, 65));

  if (a.respondentName || a.respondentDate) {
   const meta = [
    a.respondentName ? `Completed by: ${a.respondentName}` : '',
    a.respondentDate ? `Date: ${formatPdfDate(a.respondentDate)}` : ''
   ].filter(Boolean).join('   |   ');
   drawWrappedLines(meta, { size: 8.3, bold: true, color: C.muted, after: 2 });
  }

  // Table header
  doc.setFillColor(...C.navy);
  doc.rect(left, y, width, 7.2, 'F');
  doc.setFont('NotoSans', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
  doc.text('Sensory Domain (Short Sensory Profile)', left + 3, y + 4.9);
  doc.text('Raw Score', left + col1 + col2 / 2, y + 4.9, { align: 'center' });
  doc.text('Classification', left + col1 + col2 + 3, y + 4.9);
  y += 7.2;

  rows.forEach((r, idx) => {
   if (y + rowH > bottom) {
    newPage();
    doc.setFillColor(...C.navy);
    doc.rect(left, y, width, 7.2, 'F');
    doc.setFont('NotoSans', 'bold'); doc.setFontSize(8.5); doc.setTextColor(255, 255, 255);
    doc.text('Sensory Domain (Short Sensory Profile)', left + 3, y + 4.9);
    doc.text('Raw Score', left + col1 + col2 / 2, y + 4.9, { align: 'center' });
    doc.text('Classification', left + col1 + col2 + 3, y + 4.9);
    y += 7.2;
   }
   if (idx % 2 === 1) {
    doc.setFillColor(...C.tint);
    doc.rect(left, y, width, rowH, 'F');
   }
   doc.setDrawColor(...C.border); doc.setLineWidth(0.2);
   doc.rect(left, y, width, rowH, 'S');
   doc.setFont('NotoSans', 'normal'); doc.setFontSize(8.6); doc.setTextColor(...C.ink);
   doc.text(r.domain, left + 3, y + 4.7);
   doc.setFont('NotoSans', 'bold');
   doc.text(r.score, left + col1 + col2 / 2, y + 4.7, { align: 'center' });
   const clsColor = /definite/i.test(r.classification) ? C.red : /probable/i.test(r.classification) ? C.amber : C.teal;
   doc.setTextColor(...clsColor);
   doc.text(r.classification, left + col1 + col2 + 3, y + 4.7);
   y += rowH;
  });

  if (a.sspTotal || a.sspOverall) {
   ensure(rowH + 3);
   doc.setFillColor(...C.secBg);
   doc.rect(left, y, width, rowH + 0.6, 'F');
   doc.setDrawColor(...C.navy); doc.setLineWidth(0.35);
   doc.rect(left, y, width, rowH + 0.6, 'S');
   doc.setFont('NotoSans', 'bold'); doc.setFontSize(8.8); doc.setTextColor(...C.navy);
   doc.text('Overall Total Score', left + 3, y + 5.0);
   doc.text(a.sspTotal ? `${a.sspTotal} / 190` : '—', left + col1 + col2 / 2, y + 5.0, { align: 'center' });
   const ovColor = /definite/i.test(a.sspOverall || '') ? C.red : /probable/i.test(a.sspOverall || '') ? C.amber : C.navy;
   doc.setTextColor(...ovColor);
   doc.text(clean(a.sspOverall) || '—', left + col1 + col2 + 3, y + 5.0);
   y += rowH + 4;
  } else {
   y += 3;
  }
  doc.setTextColor(...C.ink);
 }

 // ---- PAGE 1 START ----
 drawHeader();

 // Report Title Banner
 doc.setFont('NotoSans', 'bold'); doc.setFontSize(14.5); doc.setTextColor(...C.navy);
 doc.text(reportTitle, left, y);
 y += 5.2;
 doc.setFont('NotoSans', 'normal'); doc.setFontSize(8); doc.setTextColor(...C.muted);
 doc.text('SULIT / CONFIDENTIAL — Release only with guardian consent and authorised clinical review.', left, y);
 y += 4.5;

 if (isDraft) {
  doc.setFillColor(...C.draftBg); doc.setDrawColor(...C.draftBorder); doc.setLineWidth(0.3);
  doc.roundedRect(left, y, width, 7.5, 1.2, 1.2, 'FD');
  doc.setFont('NotoSans', 'bold'); doc.setFontSize(8.2); doc.setTextColor(...C.draftInk);
  doc.text('DRAF / DRAFT — Belum disahkan lengkap oleh terapis. Sila semak sebelum diedarkan.', left + 3.5, y + 4.9);
  y += 10;
 }

 // Client & Assessment Information Card (2 columns)
 const leftMeta = [
  ['Client Name', clean(a.studentName) || 'Belum dipilih'],
  ['Date of Birth', formatPdfDate(a.dob)],
  ['Age at Assessment', formatPdfAge(a.dob, a.date)],
  ['Diagnosis / Status', clean(a.diagnosis) || '—']
 ];
 const dateTimeStr = formatPdfDate(a.date) + (a.time ? ` @ ${a.time}` : '');
 const followUpStr = a.followUpDate ? formatPdfDate(a.followUpDate) : (clean(a.followUpNote) || '—');
 const rightMeta = [
  ['Assessment Date', dateTimeStr],
  ['Assessor / Therapist', clean(a.therapistName) || 'Belum dipilih'],
  ['Discipline / Role', clean(a.reporterTitle) || (type === 'speech' ? 'Speech Therapist' : 'Occupational Therapist')],
  ['Next Review / TCA', followUpStr]
 ];

 const cardTop = y;
 const colW = width / 2 - 4;
 const labelW = 31;
 let leftY = cardTop + 5.5, rightY = cardTop + 5.5;

 // Measure card height first
 const measureRows = rows => rows.reduce((acc, [, val]) => {
  doc.setFont('NotoSans', 'normal'); doc.setFontSize(8.6);
  const ls = doc.splitTextToSize(val, colW - labelW - 2);
  return acc + Math.max(1, ls.length) * 4.2 + 1.4;
 }, 0);
 const cardH = Math.max(measureRows(leftMeta), measureRows(rightMeta)) + 7;

 doc.setFillColor(...C.tint); doc.setDrawColor(...C.border); doc.setLineWidth(0.3);
 doc.roundedRect(left, cardTop, width, cardH, 1.8, 1.8, 'FD');
 // Vertical divider inside card
 doc.setDrawColor(...C.border); doc.setLineWidth(0.2);
 doc.line(left + width / 2, cardTop + 3, left + width / 2, cardTop + cardH - 3);

 for (const [k, v] of leftMeta) {
  doc.setFont('NotoSans', 'bold'); doc.setFontSize(8.3); doc.setTextColor(...C.muted);
  doc.text(k, left + 3.5, leftY);
  doc.setFont('NotoSans', k === 'Client Name' ? 'bold' : 'normal'); doc.setFontSize(8.6); doc.setTextColor(...C.navy);
  const ls = doc.splitTextToSize(v, colW - labelW - 2);
  for (const l of ls) { doc.text(l, left + 3.5 + labelW, leftY); leftY += 4.2; }
  leftY += 1.4;
 }
 const rStart = left + width / 2 + 4;
 for (const [k, v] of rightMeta) {
  doc.setFont('NotoSans', 'bold'); doc.setFontSize(8.3); doc.setTextColor(...C.muted);
  doc.text(k, rStart, rightY);
  doc.setFont('NotoSans', 'normal'); doc.setFontSize(8.6); doc.setTextColor(...C.ink);
  const ls = doc.splitTextToSize(v, colW - labelW - 2);
  for (const l of ls) { doc.text(l, rStart + labelW, rightY); rightY += 4.2; }
  rightY += 1.4;
 }
 y = cardTop + cardH + 5;

 // Denver II metadata block if applicable
 let secNum = 1;
 if (type === 'ot-denver') {
  drawSectionHeader(secNum++, 'Denver II Administration Details', 'Maklumat pentadbiran');
  const dm = [
   `Manual / Version: ${clean(a.instrumentReference) || '—'}`,
   `Original Form Ref: ${clean(a.formReference) || '—'}`,
   `Administration Language: ${clean(a.screeningLanguage) || '—'}`,
   `Age Used on Chart: ${clean(a.ageUsed) || '—'} (${clean(a.ageBasis) || '—'})`,
   `Therapist Screening Result: ${clean(a.screeningResult) || '—'}`
  ].join('\n');
  drawSectionBody(dm);
 }

 // Sections loop
 const sections = (typeof assessmentSectionsFor === 'function') ? assessmentSectionsFor(a) : [];
 if (type === 'ot-ssp') {
  // For standalone SSP, show reason -> SSP score table -> domain notes -> impression -> recommendations.
  drawSectionHeader(secNum++, 'Reason for Assessment', 'Sebab penilaian');
  drawSectionBody(a.problem);
  drawSectionHeader(secNum++, 'Short Sensory Profile (SSP) Summary', 'Ringkasan skor SSP');
  drawSspTable();
  for (const [key, labelMs, labelEn] of sections) {
   if (['problem', 'impression', 'recommendations'].includes(key)) continue;
   if (!clean(a[key])) continue;
   drawSectionHeader(secNum++, labelEn, labelMs);
   drawSectionBody(a[key]);
  }
  drawSectionHeader(secNum++, 'OT Interpretation', 'Rumusan Occupational Therapist');
  drawSectionBody(a.impression);
  drawSectionHeader(secNum++, 'Recommendations & Follow-Up', 'Cadangan & susulan');
  drawSectionBody(a.recommendations);
 } else {
  for (const [key, labelMs, labelEn] of sections) {
   const hasText = Boolean(clean(a[key]));
   const isSensoryWithTable = type === 'ot-clinical' && key === 'sensoryProcessing' && (typeof hasClinicalSspScores === 'function' ? hasClinicalSspScores(a) : Boolean(a.sspTotal));
   if (!hasText && !isSensoryWithTable && type === 'ot-clinical') continue;
   if (isSensoryWithTable) ensure(78);
   drawSectionHeader(secNum++, labelEn, labelMs);
   const redundantSspSummary = isSensoryWithTable && /^Completed by\b.*\bOverall Short Sensory Profile score:/i.test(clean(a[key]));
   if (hasText && !redundantSspSummary) drawSectionBody(a[key]);
   if (isSensoryWithTable) drawSspTable();
   if (type === 'ot-denver' && clean(a[key + 'Items'])) {
    drawWrappedLines('Official Form Items & Results: ' + clean(a[key + 'Items']), { size: 8.6, color: C.muted, after: 2 });
   }
   if (clean(a[key + 'Level'])) {
    drawWrappedLines('Estimated Developmental Level: ' + clean(a[key + 'Level']), { size: 8.6, bold: true, color: C.navy, after: 2 });
   }
  }
 }

 // Sign-off & Disclaimer Card (always kept intact)
 ensure(36);
 y += 4;
 const signTop = y;
 const signLines = [
  clean(a.therapistName) || 'Belum dipilih',
  clean(a.reporterTitle) || (type === 'speech' ? 'Speech Therapist' : 'Occupational Therapist'),
  `${brand.name} — ${brand.description}`,
  clean(a.reporterPhone) ? `Tel: ${clean(a.reporterPhone)}` : ''
 ].filter(Boolean);
 const signH = 14 + signLines.length * 4.5 + 10;
 doc.setFillColor(...C.tint); doc.setDrawColor(...C.border); doc.setLineWidth(0.3);
 doc.roundedRect(left, signTop, width, signH, 1.8, 1.8, 'FD');
 doc.setFillColor(...C.yellow);
 doc.rect(left, signTop, 2.5, signH, 'F');

 let sy = signTop + 6;
 doc.setFont('NotoSans', 'bold'); doc.setFontSize(8.2); doc.setTextColor(...C.muted);
 doc.text('REPORTED BY / DILAPORKAN OLEH', left + 6, sy);
 sy += 5.2;
 signLines.forEach((l, i) => {
  doc.setFont('NotoSans', i === 0 ? 'bold' : 'normal');
  doc.setFontSize(i === 0 ? 10 : 8.6);
  doc.setTextColor(...(i === 0 ? C.navy : C.ink));
  doc.text(l, left + 6, sy);
  sy += 4.5;
 });
 sy += 1.5;
 doc.setFont('NotoSans', 'normal'); doc.setFontSize(7.4); doc.setTextColor(...C.muted);
 const disc = 'This report is based solely on clinical observations, caregiver input, and assessment findings obtained on the evaluation date. Sharing or reproduction is restricted to authorised parties with guardian consent.';
 for (const dl of doc.splitTextToSize(disc, width - 10)) {
  doc.text(dl, left + 6, sy);
  sy += 3.5;
 }

 // Draw footers on all pages
 const totalPages = doc.getNumberOfPages();
 for (let p = 1; p <= totalPages; p++) {
  doc.setPage(p);
  drawFooter(p, totalPages);
 }

 return doc;
}

if (typeof module !== 'undefined' && module.exports) {
 module.exports = { createAssessmentPdf, formatPdfDate, formatPdfAge };
}
