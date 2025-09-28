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
export function extractFields(text){
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]||'';
  const phone = text.match(/(\+?\d[\d\s-]{7,}\d)/)?.[0]||'';
  const nameLine = text.split(/\n|\r/).find(l=>/^[A-Z][a-zA-Z]+\s+[A-Z][a-zA-Z]+/.test(l))||'';
  const name = nameLine.split(/\s+/).slice(0,2).join(' ');
  return { email, phone, name };
}
