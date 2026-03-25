export interface NormalizedFile {
  type: 'image' | 'pdf' | 'text';
  mimeType: string;
  base64Data: string;
  filename: string;
}

const ACCEPTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.pdf', '.txt', '.md'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function isAcceptedFile(file: File): boolean {
  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  return ACCEPTED_EXTENSIONS.includes(ext) && file.size <= MAX_FILE_SIZE;
}

export function getAcceptString(): string {
  return '.jpg,.jpeg,.png,.webp,.pdf,.txt,.md';
}

export async function normalizeFile(file: File): Promise<NormalizedFile> {
  if (!isAcceptedFile(file)) {
    throw new Error(`File "${file.name}" is not supported or exceeds 10MB`);
  }

  const ext = '.' + file.name.split('.').pop()?.toLowerCase();
  let mimeType = file.type;
  let type: 'image' | 'pdf' | 'text';

  if (['.jpg', '.jpeg', '.png', '.webp'].includes(ext)) {
    type = 'image';
    if (!mimeType) mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  } else if (ext === '.pdf') {
    type = 'pdf';
    mimeType = 'application/pdf';
  } else {
    type = 'text';
    mimeType = 'text/plain';
  }

  const base64Data = await fileToBase64(file);

  return { type, mimeType, base64Data, filename: file.name };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export async function extractTextFromPdf(file: NormalizedFile): Promise<string> {
  // Simple fallback: decode base64 and attempt to extract readable text
  // This is a basic extraction — for production, a library like pdf.js would be better
  try {
    const binary = atob(file.base64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    // Extract text between stream markers (very basic PDF text extraction)
    const matches = text.match(/\((.*?)\)/g);
    if (matches && matches.length > 0) {
      return matches.map(m => m.slice(1, -1)).join(' ').slice(0, 10000);
    }
    return `[PDF content from ${file.filename} — text extraction limited in browser. Provider may handle natively.]`;
  } catch {
    return `[PDF file: ${file.filename}]`;
  }
}
