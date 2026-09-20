const crypto = require('crypto');
const mongoose = require('mongoose');
const Application = require('../../models/Application');

/**
 * Tokenize text into lowercase words, stripping punctuation
 * @param {string} text
 * @returns {string[]}
 */
const tokenizeWords = (text = '') => {
  if (!text || typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0);
};

/**
 * Extract the primary action verb (first word of bullet, stripping leading bullets/numbers)
 * @param {string} text
 * @returns {string}
 */
const extractActionVerb = (text = '') => {
  if (!text || typeof text !== 'string') return '';
  const cleaned = text.replace(/^[•\-\*\d\.\)\s]+/, '').trim();
  const firstWord = cleaned.split(/\s+/)[0] || '';
  return firstWord.replace(/[^\w]/g, '');
};

/**
 * Computes a detailed diff between an original string and an edited string
 * @param {string} original
 * @param {string} edited
 * @returns {object}
 */
const computeTextDiff = (original = '', edited = '') => {
  const origStr = (original || '').trim();
  const editStr = (edited || '').trim();

  if (origStr === editStr) {
    return {
      changed: false,
      originalLength: origStr.length,
      editedLength: editStr.length,
      charDelta: 0,
      originalWordCount: origStr ? tokenizeWords(origStr).length : 0,
      editedWordCount: editStr ? tokenizeWords(editStr).length : 0,
      wordCountDelta: 0,
      addedWords: [],
      removedWords: [],
      similarity: 1.0,
      actionVerbChanged: false,
      originalActionVerb: extractActionVerb(origStr),
      editedActionVerb: extractActionVerb(editStr),
    };
  }

  const origWords = tokenizeWords(origStr);
  const editWords = tokenizeWords(editStr);

  const origSet = new Set(origWords);
  const editSet = new Set(editWords);

  // Added words: in edited but not in original
  const addedWords = editWords.filter((w) => !origSet.has(w));
  // Removed words: in original but not in edited
  const removedWords = origWords.filter((w) => !editSet.has(w));

  // Unique added & removed sets for signals
  const uniqueAdded = Array.from(new Set(addedWords));
  const uniqueRemoved = Array.from(new Set(removedWords));

  // Jaccard similarity coefficient (0 to 1)
  const unionSet = new Set([...origSet, ...editSet]);
  const intersectionCount = origWords.filter((w) => editSet.has(w)).length;
  const similarity =
    unionSet.size > 0
      ? Math.max(0, Math.min(1, parseFloat((intersectionCount / unionSet.size).toFixed(3))))
      : 1.0;

  const origVerb = extractActionVerb(origStr);
  const editVerb = extractActionVerb(editStr);
  const actionVerbChanged =
    origVerb.toLowerCase() !== editVerb.toLowerCase() && Boolean(origVerb && editVerb);

  return {
    changed: true,
    originalLength: origStr.length,
    editedLength: editStr.length,
    charDelta: editStr.length - origStr.length,
    originalWordCount: origWords.length,
    editedWordCount: editWords.length,
    wordCountDelta: editWords.length - origWords.length,
    addedWords: uniqueAdded,
    removedWords: uniqueRemoved,
    similarity,
    actionVerbChanged,
    originalActionVerb: origVerb,
    editedActionVerb: editVerb,
  };
};

/**
 * Normalizes bullet input (handles array of strings or array of objects with .text)
 * @param {Array<string|object>} bullets
 * @returns {string[]}
 */
const normalizeBullets = (bullets) => {
  if (!bullets) return [];
  if (!Array.isArray(bullets)) return [];
  return bullets
    .map((b) => {
      if (typeof b === 'string') return b.trim();
      if (b && typeof b.text === 'string') return b.text.trim();
      if (b && typeof b.bullet === 'string') return b.bullet.trim();
      return '';
    })
    .filter(Boolean);
};

/**
 * Compares two bullet point arrays and returns diff entries for modified bullets
 * @param {Array<string|object>} originalBullets
 * @param {Array<string|object>} editedBullets
 * @returns {Array<object>}
 */
const collectBulletEdits = (originalBullets = [], editedBullets = []) => {
  const origList = normalizeBullets(originalBullets);
  const editList = normalizeBullets(editedBullets);
  const edits = [];

  const maxLen = Math.max(origList.length, editList.length);

  for (let i = 0; i < maxLen; i++) {
    const orig = origList[i] || '';
    const edited = editList[i] || '';

    const diff = computeTextDiff(orig, edited);
    if (diff.changed) {
      edits.push({
        id: crypto.randomUUID(),
        type: 'bullet',
        field: 'tailoredBullets',
        index: i,
        original: orig,
        edited,
        diff,
        appliedAt: new Date(),
      });
    }
  }

  return edits;
};

/**
 * Compares original and edited cover letter and returns a diff entry if modified
 * @param {string} originalCoverLetter
 * @param {string} editedCoverLetter
 * @returns {object|null}
 */
const collectCoverLetterEdit = (originalCoverLetter = '', editedCoverLetter = '') => {
  const origStr = (originalCoverLetter || '').trim();
  const editStr = (editedCoverLetter || '').trim();

  const diff = computeTextDiff(origStr, editStr);
  if (!diff.changed) return null;

  return {
    id: crypto.randomUUID(),
    type: 'cover_letter',
    field: 'coverLetter',
    index: null,
    original: origStr,
    edited: editStr,
    diff,
    appliedAt: new Date(),
  };
};

/**
 * Appends diff entries to an application's userEdits array and saves to MongoDB
 * @param {string|mongoose.Types.ObjectId|object} applicationOrId
 * @param {object} payload - { originalBullets, editedBullets, originalCoverLetter, editedCoverLetter, note }
 * @returns {Promise<{ success: boolean, newEdits: Array, allEdits: Array, application: object }>}
 */
const recordApplicationEdits = async (applicationOrId, payload = {}) => {
  let application = null;

  if (typeof applicationOrId === 'string' || applicationOrId instanceof mongoose.Types.ObjectId) {
    application = await Application.findById(applicationOrId);
  } else if (applicationOrId && typeof applicationOrId.save === 'function') {
    application = applicationOrId;
  }

  if (!application) {
    throw new Error('Application not found or invalid instance provided to recordApplicationEdits');
  }

  const newEdits = [];

  // 1. Check bullet edits
  if (payload.originalBullets || payload.editedBullets) {
    const bulletEdits = collectBulletEdits(
      payload.originalBullets || application.tailoredBullets || [],
      payload.editedBullets || []
    );
    newEdits.push(...bulletEdits);
  } else if (payload.tailoredBullets && application.tailoredBullets) {
    // When caller passed newly updated tailoredBullets vs existing application bullets
    const bulletEdits = collectBulletEdits(
      application.tailoredBullets,
      payload.tailoredBullets
    );
    newEdits.push(...bulletEdits);
  }

  // 2. Check cover letter edit
  if (payload.originalCoverLetter || payload.editedCoverLetter) {
    const clEdit = collectCoverLetterEdit(
      payload.originalCoverLetter || application.coverLetter || '',
      payload.editedCoverLetter || ''
    );
    if (clEdit) newEdits.push(clEdit);
  } else if (payload.coverLetter !== undefined && application.coverLetter) {
    // When caller passed newly updated coverLetter vs existing application coverLetter
    const clEdit = collectCoverLetterEdit(
      application.coverLetter,
      payload.coverLetter
    );
    if (clEdit) newEdits.push(clEdit);
  }

  // 3. User notes or custom instruction entry
  if (payload.note || payload.notes) {
    const noteText = (payload.note || payload.notes).trim();
    if (noteText) {
      newEdits.push({
        id: crypto.randomUUID(),
        type: 'note',
        field: 'notes',
        index: null,
        original: '',
        edited: noteText,
        diff: {
          changed: true,
          addedWords: tokenizeWords(noteText),
          removedWords: [],
          wordCountDelta: tokenizeWords(noteText).length,
        },
        appliedAt: new Date(),
      });
    }
  }

  // Only update application if diffs were detected
  if (newEdits.length > 0) {
    // Ensure application.userEdits is an array
    let currentEdits = [];
    if (Array.isArray(application.userEdits)) {
      currentEdits = application.userEdits;
    } else if (application.userEdits && typeof application.userEdits === 'object') {
      // Preserve existing legacy object as a historical record
      currentEdits = [
        {
          id: crypto.randomUUID(),
          type: 'general',
          field: 'legacy',
          original: '',
          edited: JSON.stringify(application.userEdits),
          diff: {},
          appliedAt: application.updatedAt || new Date(),
        },
      ];
    }

    application.userEdits = [...currentEdits, ...newEdits];
    application.markModified('userEdits');
    await application.save();
  }

  return {
    success: true,
    newEdits,
    allEdits: Array.isArray(application.userEdits) ? application.userEdits : [],
    application,
  };
};

/**
 * Retrieve all historical edits for a user across all their applications
 * @param {string|mongoose.Types.ObjectId} userId
 * @returns {Promise<Array<object>>}
 */
const getUserEditHistory = async (userId) => {
  if (!userId) return [];

  const applications = await Application.find({
    userId,
    userEdits: { $exists: true, $ne: null },
  })
    .select('_id company roleTitle userEdits appliedAt updatedAt')
    .lean();

  const history = [];

  for (const app of applications) {
    if (Array.isArray(app.userEdits)) {
      for (const edit of app.userEdits) {
        history.push({
          applicationId: app._id.toString(),
          company: app.company,
          roleTitle: app.roleTitle,
          ...edit,
        });
      }
    }
  }

  // Sort chronologically descending (most recent first)
  history.sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));

  return history;
};

/**
 * Extracts high-level voice & style learning signals from user edit history
 * @param {Array<object>} editHistory
 * @returns {object}
 */
const extractVoiceSignals = (editHistory = []) => {
  if (!Array.isArray(editHistory) || editHistory.length === 0) {
    return {
      totalEdits: 0,
      bulletEditsCount: 0,
      coverLetterEditsCount: 0,
      avgWordCountDelta: 0,
      concisenessPreference: 'balanced',
      topAddedWords: [],
      topRemovedWords: [],
      verbTransformations: [],
    };
  }

  let totalWordDelta = 0;
  let bulletEditsCount = 0;
  let coverLetterEditsCount = 0;

  const addedWordsMap = {};
  const removedWordsMap = {};
  const verbTransformations = [];

  for (const edit of editHistory) {
    if (edit.type === 'bullet') bulletEditsCount++;
    if (edit.type === 'cover_letter') coverLetterEditsCount++;

    const diff = edit.diff || {};
    if (typeof diff.wordCountDelta === 'number') {
      totalWordDelta += diff.wordCountDelta;
    }

    if (Array.isArray(diff.addedWords)) {
      diff.addedWords.forEach((w) => {
        addedWordsMap[w] = (addedWordsMap[w] || 0) + 1;
      });
    }

    if (Array.isArray(diff.removedWords)) {
      diff.removedWords.forEach((w) => {
        removedWordsMap[w] = (removedWordsMap[w] || 0) + 1;
      });
    }

    if (diff.actionVerbChanged && diff.originalActionVerb && diff.editedActionVerb) {
      verbTransformations.push({
        from: diff.originalActionVerb,
        to: diff.editedActionVerb,
      });
    }
  }

  const avgWordCountDelta = parseFloat((totalWordDelta / editHistory.length).toFixed(2));

  let concisenessPreference = 'balanced';
  if (avgWordCountDelta <= -2) {
    concisenessPreference = 'more_concise';
  } else if (avgWordCountDelta >= 2) {
    concisenessPreference = 'more_detailed';
  }

  // Sort top words by frequency
  const topAddedWords = Object.entries(addedWordsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  const topRemovedWords = Object.entries(removedWordsMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => ({ word, count }));

  return {
    totalEdits: editHistory.length,
    bulletEditsCount,
    coverLetterEditsCount,
    avgWordCountDelta,
    concisenessPreference,
    topAddedWords,
    topRemovedWords,
    verbTransformations,
  };
};

module.exports = {
  computeTextDiff,
  collectBulletEdits,
  collectCoverLetterEdit,
  recordApplicationEdits,
  getUserEditHistory,
  extractVoiceSignals,
  tokenizeWords,
  extractActionVerb,
};
