// Client-side .docx / .txt importer for Beruntung Brainiac Assessment Reports (zero external dependencies, CSP-safe).

async function unzipDocxEntry(arrayBuffer, targetPath) {
 const bytes = new Uint8Array(arrayBuffer);
 const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
 // Locate End of Central Directory (EOCD) signature 0x06054b50 from end of file.
 let eocd = -1;
 const minPos = Math.max(0, bytes.length - 65557);
 for (let i = bytes.length - 22; i >= minPos; i--) {
  if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
 }
 if (eocd < 0) throw new Error('Fail bukan arkib .docx yang sah.');
 const cdCount = view.getUint16(eocd + 10, true);
 let pos = view.getUint32(eocd + 16, true);
 const dec = new TextDecoder('utf-8');
 for (let i = 0; i < cdCount; i++) {
  if (view.getUint32(pos, true) !== 0x02014b50) break;
  const method = view.getUint16(pos + 10, true);
  const compSize = view.getUint32(pos + 20, true);
  const nameLen = view.getUint16(pos + 28, true);
  const extraLen = view.getUint16(pos + 30, true);
  const commentLen = view.getUint16(pos + 32, true);
  const localOffset = view.getUint32(pos + 42, true);
  const name = dec.decode(bytes.subarray(pos + 46, pos + 46 + nameLen));
  pos += 46 + nameLen + extraLen + commentLen;
  if (name !== targetPath) continue;
  if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error('Header fail .docx rosak.');
  const localNameLen = view.getUint16(localOffset + 26, true);
  const localExtraLen = view.getUint16(localOffset + 28, true);
  const dataStart = localOffset + 30 + localNameLen + localExtraLen;
  const compressed = bytes.subarray(dataStart, dataStart + compSize);
  if (method === 0) return dec.decode(compressed);
  if (method === 8) {
   if (typeof DecompressionStream !== 'undefined') {
    const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return await new Response(stream).text();
   }
   if (typeof require === 'function') {
    const zlib = require('node:zlib');
    return zlib.inflateRawSync(Buffer.from(compressed)).toString('utf8');
   }
   throw new Error('Pelayar ini tidak menyokong penyahmampatan .docx secara langsung.');
  }
  throw new Error('Kaedah mampatan .docx tidak disokong (' + method + ').');
 }
 throw new Error('Kandungan word/document.xml tidak ditemui dalam fail .docx.');
}

function xmlDecodeEntities(str) {
 return String(str || '')
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
  .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function extractParagraphsFromWordXml(xml) {
 const paragraphs = [];
 if (typeof DOMParser !== 'undefined') {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const ns = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const nodes = doc.getElementsByTagNameNS(ns, 'p');
  for (let i = 0; i < nodes.length; i++) {
   const p = nodes[i];
   let text = '';
   const walk = node => {
    for (let c = node.firstChild; c; c = c.nextSibling) {
     if (c.nodeType !== 1) continue;
     if (c.localName === 't') text += c.textContent || '';
     else if (c.localName === 'tab') text += ' ';
     else if (c.localName === 'br' || c.localName === 'cr') text += '\n';
     else walk(c);
    }
   };
   walk(p);
   for (const line of text.split('\n')) {
    const cleaned = line.replace(/\s+/g, ' ').trim();
    if (cleaned) paragraphs.push(cleaned);
   }
  }
  return paragraphs;
 }
 // Fallback regex XML parser for Node.js environments without DOMParser.
 const pMatches = xml.match(/<w:p\b[\s\S]*?<\/w:p>/g) || [];
 for (const pXml of pMatches) {
  const withBreaks = pXml.replace(/<w:(?:br|cr)\b[^>]*\/>/g, '\n').replace(/<w:tab\b[^>]*\/>/g, ' ');
  const parts = [];
  const re = /<w:t\b[^>]*>([\s\S]*?)<\/w:t>|\n/g;
  let m;
  while ((m = re.exec(withBreaks))) parts.push(m[0] === '\n' ? '\n' : xmlDecodeEntities(m[1]));
  for (const line of parts.join('').split('\n')) {
   const cleaned = line.replace(/\s+/g, ' ').trim();
   if (cleaned) paragraphs.push(cleaned);
  }
 }
 return paragraphs;
}

async function extractDocxParagraphs(arrayBuffer) {
 const xml = await unzipDocxEntry(arrayBuffer, 'word/document.xml');
 return extractParagraphsFromWordXml(xml);
}

function parseFlexibleDate(raw, fallbackYear) {
 if (!raw) return '';
 const s = String(raw).trim();
 let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
 if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
 m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
 if (m) {
  const year = m[3].length === 2 ? '20' + m[3] : m[3];
  return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
 }
 if (fallbackYear) {
  m = s.match(/\b(\d{1,2})[/.-](\d{1,2})\b/);
  if (m) return `${fallbackYear}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
 }
 return '';
}

function parseFlexibleTime(raw) {
 if (!raw) return '';
 const m = String(raw).match(/(\d{1,2})[:.](\d{2})\s*(am|pm)?/i);
 if (!m) return '';
 let h = Number(m[1]), min = Number(m[2]);
 const mer = (m[3] || '').toLowerCase();
 if (mer === 'pm' && h < 12) h += 12;
 if (mer === 'am' && h === 12) h = 0;
 if (h > 23 || min > 59) return '';
 return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function cleanClinicalLine(line) {
 let s = String(line || '').trim();
 if (!s || /^[_=\-–—]{4,}$/.test(s)) return '';
 // Normalize leading continuation markers like ":- Buttoning..."
 if (/^:\s*[-–—]\s*/.test(s)) return '• ' + s.replace(/^:\s*[-–—]\s*/, '').trim();
 // Normalize inline "Label:-value" or "Label: - value" -> "Label: value"
 s = s.replace(/^([A-Za-z][A-Za-z /&-]{1,35}?)\s*:\s*[-–—]\s*/i, '$1: ');
 s = s.replace(/^([A-Za-z][A-Za-z /&-]{1,35}?)\s*[-–—]\s*:\s*/i, '$1: ');
 return s;
}

function parseAssessmentDocument(paragraphs, fileName = '') {
 const lines = (paragraphs || []).map(l => String(l || '').trim()).filter(Boolean);
 const result = {
  type: 'ot-clinical',
  status: 'Draf',
  date: '',
  time: '',
  dob: '',
  diagnosis: '',
  importedStudentName: '',
  importedTherapistName: '',
  reporterTitle: 'Occupational Therapist',
  followUpDate: '',
  followUpNote: '',
  respondentName: '',
  respondentRelationship: '',
  respondentDate: '',
  sspTotal: '',
  sspOverall: '',
  sourceFileName: fileName
 };

 const sectionBuckets = {
  problem: [], adl: [], grossMotor: [], fineMotor: [], cognitive: [],
  socialCommunication: [], sensoryProcessing: [], behavior: [],
  impression: [], recommendations: []
 };

 const sectionMatchers = [
  ['adl', /^(?:activit(?:i|y|ies)\s+(?:of\s+)?daily\s+living|adl)\b/i],
  ['grossMotor', /^gross\s+motor(?:\s+skills?)?\b/i],
  ['fineMotor', /^fine\s+motor(?:\s+skills?)?\b/i],
  ['cognitive', /^cognitive(?:\s+skills?)?\b/i],
  ['socialCommunication', /^social\s+communication(?:\s+skills?)?\b/i],
  ['sensoryProcessing', /^sensory\s+processing\b/i],
  ['behavior', /^behavio(?:u)?ral\s+observation(?:\s+and\s+participation)?\b/i],
  ['impression', /^(?:clinical\s+analysis|clinical\s+impression|rumusan\s+klinikal)\b/i],
  ['recommendations', /^recommendations?(?:\s+for\s+parents?\s*(?:&|and)\s*school)?\b/i]
 ];

 const sspLineMatchers = [
  ['tactile', /^tactile\s+sensitivity\b/i],
  ['tasteSmell', /^taste\s*\/\s*smell\s+sensitivity\b/i],
  ['movement', /^movement\s+sensitivity\b/i],
  ['underresponsive', /^under\s*-?\s*responsive\s*\/\s*seeks?\s+sensation\b/i],
  ['auditoryFiltering', /^auditory\s+filtering\b/i],
  ['lowEnergy', /^low\s+energy\s*\/\s*weak\b/i],
  ['visualAuditory', /^visual\s*\/\s*auditory\s+sensitivity\b/i]
 ];

 let currentSection = 'problem';
 let inHeader = true;

 for (const raw of lines) {
  if (/^[_=\-–—]{4,}$/.test(raw)) { inHeader = false; continue; }

  // Header metadata detection (can appear before divider or near top).
  if (inHeader) {
   const dtMatch = raw.match(/^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4})(?:\s*@\s*(.+))?$/i);
   if (dtMatch) {
    result.date = parseFlexibleDate(dtMatch[1]) || result.date;
    if (dtMatch[2]) result.time = parseFlexibleTime(dtMatch[2]) || result.time;
    continue;
   }
   const seenMatch = raw.match(/^seen\s+by\s+([^(]+?)(?:\s*\(([^)]+)\))?$/i);
   if (seenMatch) {
    const roleText = seenMatch[1].trim();
    if (/speech/i.test(roleText)) result.reporterTitle = 'Speech Therapist';
    else if (/occupational/i.test(roleText)) result.reporterTitle = 'Occupational Therapist';
    else result.reporterTitle = roleText;
    if (seenMatch[2]) result.importedTherapistName = seenMatch[2].trim();
    continue;
   }
   const nameMatch = raw.match(/^(?:child(?:'s)?\s*name|student\s*name|nama\s*murid|name)\s*[:\-–—]+\s*(.+)$/i);
   if (nameMatch) { result.importedStudentName = nameMatch[1].replace(/^[-–—:\s]+/, '').trim(); continue; }
   const dobMatch = raw.match(/^(?:d\.?\s*o\.?\s*b\.?|date\s+of\s+birth|tarikh\s+lahir)\s*[:\-–—]+\s*(.+)$/i);
   if (dobMatch) { result.dob = parseFlexibleDate(dobMatch[1]) || result.dob; continue; }
   if (/^age\s*[:\-–—]+/i.test(raw)) { continue; }
   const diagMatch = raw.match(/^diagnosis\s*[:\-–—]+\s*(.+)$/i);
   if (diagMatch) { result.diagnosis = diagMatch[1].replace(/^[-–—:\s]+/, '').trim(); continue; }
  }

  // TCA / Follow-up line anywhere (usually at end of report).
  const tcaMatch = raw.match(/^tca\b.*$/i);
  if (tcaMatch) {
   const year = result.date ? result.date.slice(0, 4) : String(new Date().getFullYear());
   const parsed = parseFlexibleDate(raw, year);
   if (parsed) {
    // If TCA month is earlier than assessment month (e.g. Dec assessment -> Jan TCA), roll to next year.
    if (result.date && parsed < result.date) {
     const nextY = String(Number(year) + 1);
     result.followUpDate = nextY + parsed.slice(4);
    } else {
     result.followUpDate = parsed;
    }
   }
   result.followUpNote = raw.replace(/\.$/, '').trim();
   continue;
  }

  // Section header matching.
  let matchedSection = null;
  for (const [key, regex] of sectionMatchers) {
   if (regex.test(raw) && raw.length < 75) {
    matchedSection = key;
    break;
   }
  }
  if (matchedSection) {
   inHeader = false;
   currentSection = matchedSection;
   continue;
  }

  inHeader = false;

  // Inside Sensory Processing, extract structured SSP metadata & domain scores.
  if (currentSection === 'sensoryProcessing') {
   if (/^short\s+sensory\s+profile$/i.test(raw)) {
    sectionBuckets.sensoryProcessing.push('Short Sensory Profile (SSP)');
    continue;
   }
   const compMatch = raw.match(/^complet(?:e|ed)\s+by\s+([^(]+?)(?:\s*\(([^)]+)\))?$/i);
   if (compMatch) {
    const resp = compMatch[1].trim();
    result.respondentName = resp;
    result.respondentRelationship = /mother|ibu/i.test(resp) ? 'Ibu' : /father|bapa|ayah/i.test(resp) ? 'Bapa' : resp;
    if (compMatch[2]) result.respondentDate = parseFlexibleDate(compMatch[2]) || result.date;
    continue;
   }
   let matchedSsp = false;
   for (const [key, regex] of sspLineMatchers) {
    if (regex.test(raw)) {
     const sm = raw.match(/(\d+)\s*\/\s*(\d+)\s*(.*)$/);
     if (sm) {
      result[key + 'Score'] = sm[1];
      result[key + 'Classification'] = sm[3].trim();
     }
     matchedSsp = true;
     break;
    }
   }
   if (matchedSsp) continue;

   const totalMatch = raw.match(/overall\s+score\s+(?:of\s+)?(\d+)\s*\/\s*(\d+)\s*(.*)$/i);
   if (totalMatch) {
    result.sspTotal = totalMatch[1];
    result.sspOverall = totalMatch[3].trim() || `${totalMatch[1]}/${totalMatch[2]}`;
    continue;
   }
  }

  const cleaned = cleanClinicalLine(raw);
  if (cleaned) sectionBuckets[currentSection].push(cleaned);
 }

 // Trim stray single-word dangling fragments (e.g. a lone "The" at the end of a section).
 for (const [key, arr] of Object.entries(sectionBuckets)) {
  while (arr.length && /^(?:the|a|an|and|or)$/i.test(arr[arr.length - 1])) arr.pop();
  result[key] = arr.join('\n');
 }

 // If sensoryProcessing text is just the heading and we have SSP scores, give a clean summary line.
 if (hasClinicalSspScores(result) && (!result.sensoryProcessing || /^Short Sensory Profile(?:\s*\(SSP\))?$/i.test(result.sensoryProcessing.trim()))) {
  const parts = [];
  if (result.respondentName) parts.push(`Completed by ${result.respondentName}${result.respondentDate ? ` (${result.respondentDate})` : ''}.`);
  if (result.sspTotal) parts.push(`Overall Short Sensory Profile score: ${result.sspTotal}/190 (${result.sspOverall || 'Recorded'}).`);
  result.sensoryProcessing = parts.join(' ');
 }

 // Fallback date from filename if missing (e.g. Affan_Report_21112026.docx -> 2026-11-21).
 if (!result.date && fileName) {
  const fm = fileName.match(/(\d{2})(\d{2})(20\d{2})/);
  if (fm) result.date = `${fm[3]}-${fm[2]}-${fm[1]}`;
 }
 if (!result.date && typeof malaysiaToday === 'function') result.date = malaysiaToday();

 // Decide best assessment type: if no ADL/Motor/Cognitive content but SSP scores exist, use ot-ssp.
 const hasClinicalFunctional = Boolean(result.adl || result.grossMotor || result.fineMotor || result.cognitive || result.socialCommunication);
 if (!hasClinicalFunctional && hasClinicalSspScores(result)) {
  result.type = 'ot-ssp';
 }

 return result;
}

function matchRosterPerson(roster, importedName) {
 if (!importedName || !Array.isArray(roster)) return null;
 const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
 const target = norm(importedName);
 if (!target) return null;
 const exact = roster.find(p => norm(p.name) === target);
 if (exact) return exact;
 const partial = roster.find(p => {
  const pn = norm(p.name);
  return pn && (pn.includes(target) || target.includes(pn));
 });
 if (partial) return partial;
 const tokens = target.split(' ').filter(t => t.length >= 3 && !['bin', 'binti', 'muhammad', 'mohd', 'nur', 'siti'].includes(t));
 if (tokens.length) {
  return roster.find(p => {
   const pn = norm(p.name);
   return tokens.some(t => pn.includes(t));
  }) || null;
 }
 return null;
}

async function importAssessmentFile(file) {
 if (!file) return;
 if (typeof assessmentDirty !== 'undefined' && assessmentDirty) {
  notify('Simpan draf semasa atau buang perubahan sebelum mengimport laporan baharu.');
  return;
 }
 try {
  let paragraphs = [];
  if (/\.docx$/i.test(file.name)) {
   const buf = await file.arrayBuffer();
   paragraphs = await extractDocxParagraphs(buf);
  } else {
   const text = await file.text();
   paragraphs = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  }
  if (!paragraphs.length) {
   notify('Tiada kandungan teks ditemui dalam fail yang dipilih.');
   return;
  }
  const parsed = parseAssessmentDocument(paragraphs, file.name);
  const people = typeof studentRoster === 'function' ? studentRoster() : [];
  const role = typeof assessmentRole === 'function' ? assessmentRole(parsed) : 'Occupational Therapist';
  const therapists = (typeof staffRoster === 'function' ? staffRoster() : []).filter(s => s.role === role);
  const matchedStudent = matchRosterPerson(people, parsed.importedStudentName);
  const matchedTherapist = matchRosterPerson(therapists, parsed.importedTherapistName);

  const notices = [];
  if (!matchedStudent && parsed.importedStudentName) notices.push(`Murid diimport: "${parsed.importedStudentName}" (sila pilih murid daripada senarai atau daftar profil pelajar).`);
  if (!matchedTherapist && parsed.importedTherapistName) notices.push(`Terapis diimport: "${parsed.importedTherapistName}" (sila pilih terapis daripada senarai staf).`);

  assessmentActive = {
   ...parsed,
   id: 'assessment-' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now()),
   studentId: matchedStudent ? matchedStudent.id : '',
   studentName: matchedStudent ? matchedStudent.name : (parsed.importedStudentName || ''),
   therapistId: matchedTherapist ? matchedTherapist.id : '',
   therapistName: matchedTherapist ? matchedTherapist.name : (parsed.importedTherapistName || ''),
   importNotice: notices.join(' ')
  };
  assessmentDirty = true;
  if (typeof dialog !== 'undefined' && dialog.open) dialog.close();
  assessmentWorkspace();
  notify(`Laporan "${file.name}" berjaya diimport sebagai draf. Semak butiran sebelum menyimpan.`);
 } catch (err) {
  notify('Gagal mengimport fail: ' + (err?.message || 'Format tidak disokong.'));
 }
}

function triggerAssessmentImport() {
 if (typeof assessmentDirty !== 'undefined' && assessmentDirty) {
  notify('Simpan draf semasa sebelum mengimport laporan lain.');
  return;
 }
 let input = document.getElementById('assessment-import-input');
 if (!input) {
  input = document.createElement('input');
  input.type = 'file';
  input.id = 'assessment-import-input';
  input.accept = '.docx,.txt';
  input.hidden = true;
  document.body.appendChild(input);
  input.addEventListener('change', async () => {
   const file = input.files?.[0];
   input.value = '';
   if (file) await importAssessmentFile(file);
  });
 }
 input.click();
}

if (typeof document !== 'undefined') {
 document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b) return;
  if (b.hasAttribute('data-assessment-import')) {
   if (typeof dialog !== 'undefined' && dialog.open) dialog.close();
   triggerAssessmentImport();
  }
 });
}

if (typeof module !== 'undefined' && module.exports) {
 module.exports = { unzipDocxEntry, extractParagraphsFromWordXml, extractDocxParagraphs, parseAssessmentDocument, matchRosterPerson };
}
