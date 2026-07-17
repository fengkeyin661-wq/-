// @ts-ignore
import * as mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import * as XLSX from 'xlsx';

export const extractTextFromFile = async (file: File): Promise<string> => {
    const fileType = file.name.split('.').pop()?.toLowerCase();
    if (fileType === 'txt') return await file.text();
    if (fileType === 'docx' || fileType === 'doc') {
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value || '';
    }
    if (fileType === 'pdf') {
        const arrayBuffer = await file.arrayBuffer();
        // @ts-ignore
        const lib = pdfjsLib.default || pdfjsLib;
        const loadingTask = lib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map((item: any) => item.str).join(' ');
            fullText += `--- Page ${i} ---\n${pageText}\n\n`;
        }
        return fullText;
    }
    if (fileType === 'xlsx' || fileType === 'xls' || fileType === 'csv') {
        const arrayBuffer = await file.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: 'array' });
        let text = '';
        wb.SheetNames.forEach((name) => {
            const ws = wb.Sheets[name];
            text += `\n# Sheet: ${name}\n`;
            text += XLSX.utils.sheet_to_csv(ws);
            text += '\n';
        });
        return text;
    }
    throw new Error(`Unsupported format: ${fileType || 'unknown'}`);
};

