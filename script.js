const sourceFileInput = document.getElementById('sourceFile');
const rawTextInput = document.getElementById('rawText');
const sourceStatus = document.getElementById('sourceStatus');
const output = document.getElementById('output');
const generateBtn = document.getElementById('generateBtn');
const downloadPdfBtn = document.getElementById('downloadPdfBtn');

const mcqCountInput = document.getElementById('mcqCount');
const saqCountInput = document.getElementById('saqCount');
const longCountInput = document.getElementById('longCount');
const tfCountInput = document.getElementById('tfCount');
const blankCountInput = document.getElementById('blankCount');

let extractedText = '';

sourceFileInput.addEventListener('change', async (event) => {
  const [file] = event.target.files;
  if (!file) {
    return;
  }

  sourceStatus.textContent = `Processing ${file.name}...`;

  try {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      extractedText = await extractPdfText(file);
      sourceStatus.textContent = `PDF loaded (${extractedText.length} characters extracted).`;
    } else if (file.type.startsWith('image/')) {
      extractedText = await extractImageText(file);
      sourceStatus.textContent = `Image OCR complete (${extractedText.length} characters extracted).`;
    } else {
      sourceStatus.textContent = 'Unsupported file type. Please upload PDF or image.';
      extractedText = '';
    }
  } catch (error) {
    console.error(error);
    extractedText = '';
    sourceStatus.textContent = `Could not process file: ${error.message}`;
  }
});

generateBtn.addEventListener('click', () => {
  const userText = rawTextInput.value.trim();
  const baseText = userText || extractedText;

  if (!baseText) {
    output.value = 'Please upload a file or paste text before generating questions.';
    return;
  }

  const mcqCount = parseInt(mcqCountInput.value, 10) || 0;
  const saqCount = parseInt(saqCountInput.value, 10) || 0;
  const longCount = parseInt(longCountInput.value, 10) || 0;
  const tfCount = parseInt(tfCountInput.value, 10) || 0;
  const blankCount = parseInt(blankCountInput.value, 10) || 0;

  const questions = generatePattern(baseText, {
    mcqCount,
    saqCount,
    longCount,
    tfCount,
    blankCount,
  });
  output.value = questions;
});

downloadPdfBtn.addEventListener('click', () => {
  const textToExport = output.value.trim();

  if (!textToExport || textToExport === 'Your generated question set will appear here.') {
    sourceStatus.textContent = 'Generate or edit questions first, then download the PDF.';
    return;
  }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  const margin = 12;
  const lineHeight = 7;
  const pageHeight = doc.internal.pageSize.getHeight();
  const wrappedLines = doc.splitTextToSize(textToExport, 180);
  let y = 20;

  doc.setFontSize(12);
  doc.text('Generated Question Pattern', margin, 12);

  wrappedLines.forEach((line) => {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = 20;
    }

    doc.text(line, margin, y);
    y += lineHeight;
  });

  doc.save('question-pattern.pdf');
  sourceStatus.textContent = 'PDF downloaded successfully.';
});

async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const typedArray = new Uint8Array(arrayBuffer);

  const pdfjsLib = await import('https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.min.mjs');
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.5.136/build/pdf.worker.min.mjs';

  const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
  let allText = '';

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(' ');
    allText += ` ${pageText}`;
  }

  return allText.trim();
}

async function extractImageText(file) {
  const result = await Tesseract.recognize(file, 'eng', {
    logger: () => {},
  });

  return result.data.text.trim();
}

function generatePattern(text, counts) {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((item) => item.trim())
    .filter((item) => item.length > 20);

  const topicWords = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 4);

  const uniqueWords = [...new Set(topicWords)].slice(0, 20);

  let index = 0;
  const nextSentence = () => {
    const sentence = sentences[index % Math.max(sentences.length, 1)] || 'the provided content';
    index += 1;
    return sentence;
  };

  const lines = ['=== Custom Question Pattern ===', ''];

  if (counts.mcqCount > 0) {
    lines.push(`Section A: MCQ (${counts.mcqCount})`);
    for (let i = 1; i <= counts.mcqCount; i += 1) {
      const keyword = uniqueWords[(i - 1) % Math.max(uniqueWords.length, 1)] || 'topic';
      lines.push(`${i}. Which statement best describes "${keyword}" in the context of the text?`);
      lines.push('   A) Main concept    B) Supporting detail    C) Counterpoint    D) Not mentioned');
    }
    lines.push('');
  }

  if (counts.saqCount > 0) {
    lines.push(`Section B: Short Answer Questions (${counts.saqCount})`);
    for (let i = 1; i <= counts.saqCount; i += 1) {
      lines.push(`${i}. In 3-4 lines, explain: ${nextSentence()}`);
    }
    lines.push('');
  }

  if (counts.longCount > 0) {
    lines.push(`Section C: Long Questions (${counts.longCount})`);
    for (let i = 1; i <= counts.longCount; i += 1) {
      const keyword = uniqueWords[(i + 2) % Math.max(uniqueWords.length, 1)] || 'core idea';
      lines.push(`${i}. Write a detailed answer on "${keyword}" with examples and critical analysis.`);
    }
    lines.push('');
  }

  if (counts.tfCount > 0) {
    lines.push(`Section D: True/False (${counts.tfCount})`);
    for (let i = 1; i <= counts.tfCount; i += 1) {
      lines.push(`${i}. True or False: ${nextSentence()}`);
    }
    lines.push('');
  }

  if (counts.blankCount > 0) {
    lines.push(`Section E: Fill in the Blanks (${counts.blankCount})`);
    for (let i = 1; i <= counts.blankCount; i += 1) {
      const keyword = uniqueWords[(i + 5) % Math.max(uniqueWords.length, 1)] || 'concept';
      lines.push(`${i}. __________ is closely related to "${keyword}" in the provided text.`);
    }
    lines.push('');
  }

  if (lines.length <= 2) {
    return 'Please choose at least one question type count greater than zero.';
  }

  return lines.join('\n');
}
