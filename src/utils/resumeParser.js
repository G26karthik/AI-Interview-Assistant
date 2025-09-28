import * as pdfjsLib from 'pdfjs-dist';
// Use Vite's asset handling to bundle worker locally instead of remote CDN (fixes 404)
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import mammoth from 'mammoth';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function parsePDF(file){
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for(let i=1;i<=pdf.numPages;i++){
    const page = await pdf.getPage(i); const content = await page.getTextContent();
    text += content.items.map(it=>it.str).join(' ') + '\n';
  }
  return text;
}
export async function parseDOCX(file){
  const arrayBuffer = await file.arrayBuffer();
  const { value } = await mammoth.extractRawText({ arrayBuffer });
  return value;
}
function normalizeWhitespace(value){
  return value.replace(/\s+/g,' ').trim();
}

function guessNameLine(lines){
  const isLikelyName = (line)=>{
    if(!line) return false;
    const cleaned = line.replace(/[,|]/g,' ');
    const words = cleaned.trim().split(/\s+/);
    if(words.length < 2 || words.length > 4) return false;
    if(words.some(word=>/[0-9@]/.test(word))) return false;
    const alphaWordCount = words.filter(word=>/[A-Za-z]/.test(word)).length;
    if(alphaWordCount < 2) return false;
    const hasCapitalized = words.some(word=>/^[A-Z][a-z'-]+$/.test(word));
    const allUpper = words.every(word=>/^[A-Z][A-Z'-]+$/.test(word));
    return hasCapitalized || allUpper;
  };

  return lines.find(isLikelyName) || '';
}

function toTitleCase(line){
  return line.split(/\s+/).map(word=>{
    const lowered = word.toLowerCase();
    if(!/[a-z]/.test(lowered)) return word;
    return lowered.charAt(0).toUpperCase()+lowered.slice(1);
  }).join(' ');
}

export function extractFields(text){
  if(!text) return { email: '', phone: '', name: '' };

  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||'';
  const phoneMatch = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  const phone = phoneMatch ? normalizeWhitespace(phoneMatch[0]).replace(/[.]/g,'') : '';

  const lines = text.split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
  const nameLine = guessNameLine(lines);
  const name = nameLine ? toTitleCase(normalizeWhitespace(nameLine)) : '';

  return { email, phone, name };
}
