const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

const source = [
  read('src/content.js'),
  read('src/learning.js'),
  read('src/frequency-dictionary-data.js'),
  'globalThis.__data = { SENTENCES, TOPICS, FREQUENCY_DICTIONARY };'
].join('\n');

const sandbox = { console };
vm.createContext(sandbox);
vm.runInContext(source, sandbox);

const { SENTENCES, TOPICS, FREQUENCY_DICTIONARY } = sandbox.__data;

console.log(`Loaded ${SENTENCES.length} sentences, ${TOPICS.length} topics, ${FREQUENCY_DICTIONARY.length} freq words.`);

const issues = [];

// 1. Audit SENTENCES
SENTENCES.forEach((s) => {
  // Check trailing spaces or strange characters
  if (/\s{2,}/.test(s.de)) issues.push({ type: 'sentence_de_doublespace', id: s.id, text: s.de });
  if (/\s{2,}/.test(s.en)) issues.push({ type: 'sentence_en_doublespace', id: s.id, text: s.en });
  
  // Check German ending punctuation (. ? !)
  if (!/[.?!]$/.test(s.de.trim())) issues.push({ type: 'sentence_de_no_punct', id: s.id, text: s.de });
  if (!/[.?!]$/.test(s.en.trim())) issues.push({ type: 'sentence_en_no_punct', id: s.id, text: s.en });

  // Check vocab in sentence
  if (s.vocab) {
    s.vocab.forEach((v, vIdx) => {
      if (!v.de || !v.en) issues.push({ type: 'sentence_vocab_empty', id: s.id, vIdx, v });
      if (/\s{2,}/.test(v.de) || /\s{2,}/.test(v.en)) issues.push({ type: 'sentence_vocab_doublespace', id: s.id, v });
    });
  }

  // Check variants
  if (s.learn && s.learn.variants) {
    s.learn.variants.forEach((va, vaIdx) => {
      if (!va.de || !va.use) issues.push({ type: 'variant_empty', id: s.id, vaIdx, va });
      if (!/[.?!]$/.test(va.de.trim())) issues.push({ type: 'variant_de_no_punct', id: s.id, text: va.de });
    });
  }
});

// 2. Audit FREQUENCY_DICTIONARY
FREQUENCY_DICTIONARY.forEach(f => {
  // Check empty fields
  if (!f.german || !f.english || !f.germanSentence || !f.englishSentence) {
    issues.push({ type: 'freq_empty_field', rank: f.rank, f });
  }

  // Check double spaces
  if (/\s{2,}/.test(f.german)) issues.push({ type: 'freq_de_doublespace', rank: f.rank, text: f.german });
  if (/\s{2,}/.test(f.english)) issues.push({ type: 'freq_en_doublespace', rank: f.rank, text: f.english });
  if (/\s{2,}/.test(f.germanSentence)) issues.push({ type: 'freq_de_sent_doublespace', rank: f.rank, text: f.germanSentence });
  if (/\s{2,}/.test(f.englishSentence)) issues.push({ type: 'freq_en_sent_doublespace', rank: f.rank, text: f.englishSentence });

  // Check sentence punctuation
  if (!/[.?!…»”"\'’“]$/.test(f.germanSentence.trim())) issues.push({ type: 'freq_de_sent_no_punct', rank: f.rank, text: f.germanSentence });
  if (!/[.?!…»”"\'’“]$/.test(f.englishSentence.trim())) issues.push({ type: 'freq_en_sent_no_punct', rank: f.rank, text: f.englishSentence });

  // Check if first letter of German sentence is capitalized
  if (/^[a-zäöü]/.test(f.germanSentence.trim())) {
    issues.push({ type: 'freq_de_sent_uncapitalized', rank: f.rank, text: f.germanSentence });
  }
  // Check if first letter of English sentence is capitalized
  if (/^[a-z]/.test(f.englishSentence.trim()) && !/^"?[a-z]/.test(f.englishSentence.trim())) {
    issues.push({ type: 'freq_en_sent_uncapitalized', rank: f.rank, text: f.englishSentence });
  }
});

console.log(`Found ${issues.length} structural/formatting anomalies.`);
if (issues.length > 0) {
  console.log(JSON.stringify(issues, null, 2));
}
