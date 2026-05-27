const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

async function extractTextFromFile(buffer, mimetype) {
  if (mimetype === 'application/pdf') {
    const data = await pdfParse(buffer);
    return data.text;
  } else if (mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const data = await mammoth.extractRawText({ buffer });
    return data.value;
  } else {
    throw new Error('Unsupported file type');
  }
}

// Parse exam text handling THPT format (Câu X. A. B. C. D. with passage context above)
function parseExamText(text) {
  const questions = [];
  
  // Regex to find each "Câu X." or "Question X." marker and its position
  const markerRegex = /(?:Câu|Question)\s*(\d+)\s*[:.]/gi;
  const markers = [];
  let m;
  while ((m = markerRegex.exec(text)) !== null) {
    markers.push({ index: m.index, length: m[0].length, number: parseInt(m[1]) });
  }
  
  for (let i = 0; i < markers.length; i++) {
    const marker = markers[i];
    const nextMarkerIndex = i + 1 < markers.length ? markers[i + 1].index : text.length;
    
    // Text of this question block (after the Câu X. marker)
    const block = text.substring(marker.index + marker.length, nextMarkerIndex).trim();
    
    // Look for options: find where first A. or A) starts
    const optionStartMatch = block.match(/(?:^|\n)\s*A[.)]\s+/im);
    
    let content = '';
    let opts = [];
    
    if (optionStartMatch) {
      content = block.substring(0, optionStartMatch.index).trim();
      const optBlock = block.substring(optionStartMatch.index).trim();
      
      // Parse options A, B, C, D – each ends when next option starts
      const optRegex = /[A-D][.)]\s+([\s\S]+?)(?=\n?\s*[B-D][.)]\s|\s*$)/gi;
      let om;
      while ((om = optRegex.exec(optBlock)) !== null) {
        const optText = om[1].replace(/\s+/g, ' ').trim().substring(0, 250);
        opts.push(optText);
      }
    }
    
    // If content is empty, look backward for the nearest passage/sentence context
    // (text between previous question end and this question start, max 1000 chars)
    if (!content) {
      const prevEnd = i > 0 ? markers[i - 1].index + markers[i - 1].length + 
        text.substring(markers[i - 1].index + markers[i - 1].length, markers[i].index).length : 0;
      const contextStart = Math.max(0, marker.index - 1200);
      const contextRaw = text.substring(contextStart, marker.index).trim();
      
      // Take last meaningful paragraph before this question (skip blank lines)
      const paragraphs = contextRaw.split(/\n{2,}/).filter(p => p.trim().length > 10);
      if (paragraphs.length > 0) {
        // Use last paragraph as context (usually the sentence/passage for this question)
        const lastPara = paragraphs[paragraphs.length - 1].trim();
        // Only use if it doesn't look like another question
        if (!/(?:Câu|Question)\s*\d+/i.test(lastPara)) {
          content = lastPara.substring(0, 800);
        }
      }
    }
    
    if (opts.length >= 2) {
      questions.push({
        qNumber: marker.number,
        content: content,
        options: opts.slice(0, 4)
      });
    } else if (block.trim()) {
      // Store question even if we can't parse options
      questions.push({ qNumber: marker.number, content: content || block.substring(0, 400), options: [] });
    }
  }
  
  return questions;
}

// Basic regex to match "Câu 1: A. Giải thích: ..."
function parseAnswerText(text) {
  const answers = {};
  // Split by "Câu " or "Question "
  const parts = text.split(/(?:Câu|Question)\s*\d+\s*[:\.]/gi);
  
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i].trim();
    // Look for an option letter right after "Câu X:"
    const ansMatch = part.match(/^([A-D])[\.\s]/i);
    const correctOption = ansMatch ? ansMatch[1].toUpperCase() : 'A'; // default fallback
    
    // Look for explanation (everything after "Giải thích:" or just the rest)
    let explanation = part;
    const expMatch = part.match(/Giải thích\s*:\s*(.*)/is);
    if (expMatch) {
      explanation = expMatch[1].trim();
    }
    
    answers[i] = { correctOption, explanation };
  }
  return answers;
}

function combineExamAndAnswers(examQuestions, answerData) {
  return examQuestions.map(q => {
    const ans = answerData[q.qNumber] || { correctOption: 'A', explanation: '' };
    return {
      content: q.content,
      type: 'Grammar', // Default, could be refined
      difficulty: 'Medium', // Default
      options: JSON.stringify(q.options),
      correctOption: ans.correctOption,
      explanation: ans.explanation
    };
  });
}

module.exports = {
  extractTextFromFile,
  parseExamText,
  parseAnswerText,
  combineExamAndAnswers
};
