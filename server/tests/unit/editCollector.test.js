const {
  computeTextDiff,
  collectBulletEdits,
  collectCoverLetterEdit,
  extractVoiceSignals,
  tokenizeWords,
  extractActionVerb,
} = require('../../src/services/voiceLearning/editCollector');

describe('Voice Learning: editCollector Service Unit Tests', () => {
  describe('Helper Utilities', () => {
    it('tokenizeWords should extract clean lowercase words and strip punctuation', () => {
      expect(tokenizeWords('Spearheaded, 10+ microservices; with Docker & Redis!'))
        .toEqual(['spearheaded', '10', 'microservices', 'with', 'docker', 'redis']);
      expect(tokenizeWords('')).toEqual([]);
      expect(tokenizeWords(null)).toEqual([]);
    });

    it('extractActionVerb should extract the first word stripping punctuation', () => {
      expect(extractActionVerb('Orchestrated high-throughput Kafka streaming pipeline.')).toBe('Orchestrated');
      expect(extractActionVerb('• Developed real-time analytics')).toBe('Developed');
      expect(extractActionVerb('')).toBe('');
      expect(extractActionVerb(null)).toBe('');
    });
  });

  describe('computeTextDiff', () => {
    it('should return unchanged: false when strings match exactly', () => {
      const text = 'Engineered distributed microservices platform with Go and gRPC.';
      const diff = computeTextDiff(text, text);

      expect(diff.changed).toBe(false);
      expect(diff.charDelta).toBe(0);
      expect(diff.wordCountDelta).toBe(0);
      expect(diff.addedWords).toEqual([]);
      expect(diff.removedWords).toEqual([]);
      expect(diff.similarity).toBe(1.0);
      expect(diff.actionVerbChanged).toBe(false);
    });

    it('should compute addedWords, removedWords, deltas, and action verb replacement', () => {
      const original = 'Spearheaded large-scale deployment of Elasticsearch clusters across multi-cloud regions.';
      const edited = 'Led deployment of Elasticsearch and OpenSearch clusters across AWS regions.';

      const diff = computeTextDiff(original, edited);

      expect(diff.changed).toBe(true);
      expect(diff.actionVerbChanged).toBe(true);
      expect(diff.originalActionVerb).toBe('Spearheaded');
      expect(diff.editedActionVerb).toBe('Led');
      expect(diff.addedWords).toContain('opensearch');
      expect(diff.addedWords).toContain('aws');
      expect(diff.removedWords).toContain('large-scale');
      expect(diff.removedWords).toContain('multi-cloud');
      expect(diff.charDelta).toBeLessThan(0); // edited is shorter
      expect(diff.similarity).toBeGreaterThan(0.4);
      expect(diff.similarity).toBeLessThan(1.0);
    });
  });

  describe('collectBulletEdits', () => {
    it('should return empty array when all bullets are identical', () => {
      const bullets = [
        'Architected real-time fraud detection pipeline with Flink.',
        'Scaled PostgreSQL read replicas to handle 25,000 QPS.',
      ];

      const diffs = collectBulletEdits(bullets, bullets);
      expect(diffs).toEqual([]);
    });

    it('should return structured edit entries only for modified bullets', () => {
      const original = [
        'Architected real-time fraud detection pipeline with Flink.',
        'Spearheaded migration of legacy monolith to Kubernetes.',
        'Mentored 4 junior engineers on distributed systems best practices.',
      ];

      const edited = [
        'Architected real-time fraud detection pipeline with Flink.', // unchanged
        'Led migration of legacy monolith to EKS and Docker.',       // modified
        'Mentored 6 junior engineers on microservices architecture.', // modified
      ];

      const diffs = collectBulletEdits(original, edited);

      expect(diffs.length).toBe(2);

      // Check first modified bullet (index 1)
      expect(diffs[0].type).toBe('bullet');
      expect(diffs[0].field).toBe('tailoredBullets');
      expect(diffs[0].index).toBe(1);
      expect(diffs[0].original).toContain('Spearheaded migration');
      expect(diffs[0].edited).toContain('Led migration');
      expect(diffs[0].diff.actionVerbChanged).toBe(true);
      expect(diffs[0].diff.addedWords).toContain('eks');

      // Check second modified bullet (index 2)
      expect(diffs[1].index).toBe(2);
      expect(diffs[1].diff.addedWords).toContain('microservices');
      expect(diffs[1].diff.removedWords).toContain('distributed');
    });

    it('should handle bullet objects with .text or .bullet keys', () => {
      const original = [{ text: 'Built payment engine with Node.js.' }];
      const edited = [{ text: 'Engineered payment engine with Node.js and Redis.' }];

      const diffs = collectBulletEdits(original, edited);
      expect(diffs.length).toBe(1);
      expect(diffs[0].diff.addedWords).toContain('redis');
    });
  });

  describe('collectCoverLetterEdit', () => {
    it('should return null when cover letter is unchanged', () => {
      const letter = 'Dear Hiring Manager,\nI am thrilled to apply for the Senior Backend Engineer role...';
      expect(collectCoverLetterEdit(letter, letter)).toBeNull();
    });

    it('should return a structured cover letter diff entry when modified', () => {
      const original = 'I have 5 years experience with backend systems and Java.';
      const edited = 'I have 7+ years of hands-on experience architecting high-scale distributed systems in Go and Rust.';

      const editEntry = collectCoverLetterEdit(original, edited);

      expect(editEntry).not.toBeNull();
      expect(editEntry.type).toBe('cover_letter');
      expect(editEntry.field).toBe('coverLetter');
      expect(editEntry.diff.changed).toBe(true);
      expect(editEntry.diff.addedWords).toContain('rust');
      expect(editEntry.diff.addedWords).toContain('go');
      expect(editEntry.diff.removedWords).toContain('java');
    });
  });

  describe('extractVoiceSignals', () => {
    it('should provide default balanced signals when edit history is empty', () => {
      const signals = extractVoiceSignals([]);
      expect(signals.totalEdits).toBe(0);
      expect(signals.concisenessPreference).toBe('balanced');
      expect(signals.topAddedWords).toEqual([]);
      expect(signals.verbTransformations).toEqual([]);
    });

    it('should detect more_concise preference and verb transformation trends', () => {
      const mockHistory = [
        {
          type: 'bullet',
          diff: {
            wordCountDelta: -4,
            addedWords: ['led', 'aws'],
            removedWords: ['spearheaded', 'successfully'],
            actionVerbChanged: true,
            originalActionVerb: 'Spearheaded',
            editedActionVerb: 'Led',
          },
        },
        {
          type: 'bullet',
          diff: {
            wordCountDelta: -3,
            addedWords: ['built', 'aws'],
            removedWords: ['orchestrated', 'efficiently'],
            actionVerbChanged: true,
            originalActionVerb: 'Orchestrated',
            editedActionVerb: 'Built',
          },
        },
      ];

      const signals = extractVoiceSignals(mockHistory);

      expect(signals.totalEdits).toBe(2);
      expect(signals.bulletEditsCount).toBe(2);
      expect(signals.avgWordCountDelta).toBe(-3.5);
      expect(signals.concisenessPreference).toBe('more_concise');
      expect(signals.topAddedWords[0].word).toBe('aws');
      expect(signals.topAddedWords[0].count).toBe(2);
      expect(signals.verbTransformations).toHaveLength(2);
      expect(signals.verbTransformations[0]).toEqual({ from: 'Spearheaded', to: 'Led' });
    });
  });
});
