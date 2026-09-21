const fs = require('fs');
const path = require('path');

const EXTENSION_DIR = path.resolve(__dirname, '../../../extension');

describe('Phase 105 Browser Extension Scaffold Tests', () => {
  describe('Manifest V3 Structure & Integrity', () => {
    const manifestPath = path.join(EXTENSION_DIR, 'manifest.json');
    let manifest;

    beforeAll(() => {
      expect(fs.existsSync(manifestPath)).toBe(true);
      manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    });

    it('should be configured as Chrome Manifest V3', () => {
      expect(manifest.manifest_version).toBe(3);
      expect(manifest.name).toContain('ApplyForge');
      expect(manifest.version).toBe('1.0.0');
      expect(manifest.description).toBeDefined();
    });

    it('should configure background service worker correctly for MV3', () => {
      expect(manifest.background).toBeDefined();
      expect(manifest.background.service_worker).toBe('background.js');
      expect(fs.existsSync(path.join(EXTENSION_DIR, manifest.background.service_worker))).toBe(true);
    });

    it('should declare action popup with icons', () => {
      expect(manifest.action).toBeDefined();
      expect(manifest.action.default_popup).toBe('popup.html');
      expect(fs.existsSync(path.join(EXTENSION_DIR, manifest.action.default_popup))).toBe(true);
      expect(manifest.action.default_icon).toBeDefined();
    });

    it('should declare required permissions and host permissions', () => {
      expect(manifest.permissions).toContain('activeTab');
      expect(manifest.permissions).toContain('storage');
      expect(manifest.permissions).toContain('scripting');

      expect(manifest.host_permissions).toEqual(
        expect.arrayContaining([
          expect.stringContaining('linkedin.com'),
          expect.stringContaining('naukri.com'),
        ])
      );
    });

    it('should configure content script matches for LinkedIn and Naukri', () => {
      expect(Array.isArray(manifest.content_scripts)).toBe(true);
      expect(manifest.content_scripts.length).toBeGreaterThan(0);

      const contentScript = manifest.content_scripts[0];
      expect(contentScript.js).toContain('content.js');
      expect(contentScript.css).toContain('content.css');
      expect(fs.existsSync(path.join(EXTENSION_DIR, 'content.js'))).toBe(true);
      expect(fs.existsSync(path.join(EXTENSION_DIR, 'content.css'))).toBe(true);

      const allMatches = contentScript.matches.join(' ');
      expect(allMatches).toContain('linkedin.com');
      expect(allMatches).toContain('naukri.com');
    });

    it('should verify all icon assets exist and have non-zero file size', () => {
      ['16', '32', '48', '128'].forEach((sz) => {
        const iconRelPath = manifest.icons[sz];
        expect(iconRelPath).toBeDefined();
        const iconFullPath = path.join(EXTENSION_DIR, iconRelPath);
        expect(fs.existsSync(iconFullPath)).toBe(true);
        const stat = fs.statSync(iconFullPath);
        expect(stat.size).toBeGreaterThan(50);
      });
    });
  });

  describe('Content Script Job Detection Logic', () => {
    const contentScript = require('../../../extension/content.js');

    it('should clean and normalize text appropriately', () => {
      expect(contentScript.cleanText('   Software    Engineer   \n  \t ')).toBe('Software Engineer');
      expect(contentScript.cleanText('')).toBe('');
      expect(contentScript.cleanText(null)).toBe('');
    });

    it('should extract LinkedIn job details using DOM selectors', () => {
      // Create minimal fake DOM container
      const fakeDoc = {
        querySelector: (sel) => {
          if (sel.includes('job-details-jobs-unified-top-card__job-title')) {
            return { textContent: 'Senior Backend Engineer' };
          }
          if (sel.includes('job-details-jobs-unified-top-card__company-name')) {
            return { textContent: 'Stripe' };
          }
          if (sel.includes('job-details-jobs-unified-top-card__bullet')) {
            return { textContent: 'San Francisco, CA' };
          }
          if (sel === '#job-details') {
            return { textContent: 'We are seeking an experienced Backend Engineer to scale our payment platform using Node.js.' };
          }
          return null;
        },
      };

      const result = contentScript.detectLinkedInJob(fakeDoc);
      expect(result).not.toBeNull();
      expect(result.detected).toBe(true);
      expect(result.platform).toBe('linkedin');
      expect(result.title).toBe('Senior Backend Engineer');
      expect(result.company).toBe('Stripe');
      expect(result.location).toBe('San Francisco, CA');
      expect(result.description).toContain('Backend Engineer to scale our payment platform');
    });

    it('should extract Naukri job details using DOM selectors', () => {
      const fakeDoc = {
        querySelector: (sel) => {
          if (sel.includes('styles_jd-header-title__rZwM1') || sel.includes('jd-header-title')) {
            return { textContent: 'Lead Full Stack Developer' };
          }
          if (sel.includes('styles_jd-header-comp-name__MvqAI') || sel.includes('jd-header-comp-name')) {
            return { textContent: 'Infosys Limited' };
          }
          if (sel.includes('styles_jhc__location__kJZ1m')) {
            return { textContent: 'Bengaluru, India' };
          }
          if (sel.includes('styles_JDJOB__text__0Qk3i') || sel.includes('job-desc-section')) {
            return { textContent: 'Required Skills: React, Node.js, MongoDB, Microservices with 6+ years experience.' };
          }
          return null;
        },
      };

      const result = contentScript.detectNaukriJob(fakeDoc);
      expect(result).not.toBeNull();
      expect(result.detected).toBe(true);
      expect(result.platform).toBe('naukri');
      expect(result.title).toBe('Lead Full Stack Developer');
      expect(result.company).toBe('Infosys Limited');
      expect(result.location).toBe('Bengaluru, India');
      expect(result.description).toContain('Required Skills: React, Node.js');
    });

    it('should extract JSON-LD JobPosting data when present', () => {
      const jsonLdPayload = {
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: 'Staff DevOps Engineer',
        description: '<p>Looking for a Staff DevOps Engineer proficient in Kubernetes and Terraform.</p>',
        hiringOrganization: {
          '@type': 'Organization',
          name: 'HashiCorp',
        },
        jobLocation: {
          '@type': 'Place',
          address: {
            addressLocality: 'Remote, US',
          },
        },
      };

      const fakeDoc = {
        querySelectorAll: (sel) => {
          if (sel.includes('application/ld+json')) {
            return [{ textContent: JSON.stringify(jsonLdPayload) }];
          }
          return [];
        },
      };

      const result = contentScript.detectJsonLdJob(fakeDoc);
      expect(result).not.toBeNull();
      expect(result.detected).toBe(true);
      expect(result.title).toBe('Staff DevOps Engineer');
      expect(result.company).toBe('HashiCorp');
      expect(result.location).toBe('Remote, US');
      expect(result.description).toContain('Looking for a Staff DevOps Engineer');
    });
  });

  describe('Background Service Worker Logic', () => {
    const backgroundWorker = require('../../../extension/background.js');

    it('should export DEFAULT_CONFIG targeting localhost:5000', () => {
      expect(backgroundWorker.DEFAULT_CONFIG).toBeDefined();
      expect(backgroundWorker.DEFAULT_CONFIG.serverUrl).toBe('http://localhost:5000');
    });

    it('should detect supported job board URLs correctly', () => {
      expect(
        backgroundWorker.isSupportedJobUrl('https://www.linkedin.com/jobs/view/3920194857/')
      ).toBe(true);
      expect(
        backgroundWorker.isSupportedJobUrl('https://www.naukri.com/job-listings-frontend-engineer-delhi-1234')
      ).toBe(true);
      expect(
        backgroundWorker.isSupportedJobUrl('https://boards.greenhouse.io/airbnb/jobs/50123')
      ).toBe(true);
      expect(
        backgroundWorker.isSupportedJobUrl('https://jobs.lever.co/netflix/98765')
      ).toBe(true);

      // Non-job URLs should return false
      expect(backgroundWorker.isSupportedJobUrl('https://www.linkedin.com/feed/')).toBe(false);
      expect(backgroundWorker.isSupportedJobUrl('https://www.google.com/search?q=jobs')).toBe(false);
      expect(backgroundWorker.isSupportedJobUrl('')).toBe(false);
      expect(backgroundWorker.isSupportedJobUrl(null)).toBe(false);
    });
  });

  describe('Phase 106 Content Script JD Capture & Text Formatting', () => {
    const contentScript = require('../../../extension/content.js');

    it('should accurately calculate word counts with countWords', () => {
      expect(contentScript.countWords('Hello world')).toBe(2);
      expect(contentScript.countWords('  Frontend   Engineer with   React,   TypeScript &  Node.js  ')).toBe(7);
      expect(contentScript.countWords('')).toBe(0);
      expect(contentScript.countWords(null)).toBe(0);
    });

    it('should safely extract selected text using getSelectedText', () => {
      const selected = contentScript.getSelectedText();
      expect(typeof selected).toBe('string');
      expect(selected).toBe('');
    });

    it('should extract formatted text preserving bullet points and paragraphs', () => {
      // Simulate DOM element with innerHTML
      const mockElement = {
        innerHTML: '<h3>About the Role</h3><p>We are hiring a Senior Engineer.</p><ul><li>5+ years React</li><li>Strong Node.js</li></ul>',
        querySelectorAll: () => [],
        textContent: 'About the Role We are hiring a Senior Engineer. 5+ years React Strong Node.js',
      };

      const formatted = contentScript.extractFormattedText(mockElement);
      expect(formatted).toContain('About the Role');
      expect(formatted).toContain('We are hiring a Senior Engineer.');
      expect(formatted).toContain('• 5+ years React');
      expect(formatted).toContain('• Strong Node.js');
    });

    it('should strip boilerplate button labels like Show more', () => {
      const mockElement = {
        innerHTML: '<p>Job description text here.</p><button>Show more</button>',
        querySelectorAll: () => [],
      };

      const formatted = contentScript.extractFormattedText(mockElement);
      expect(formatted).toContain('Job description text here.');
      expect(formatted).not.toContain('Show more');
    });

    it('should produce structured capture payload with wordCount and charCount', () => {
      const fakeDoc = {
        querySelector: (sel) => {
          if (sel.includes('job-details-jobs-unified-top-card__job-title')) {
            return { textContent: 'Full Stack Tech Lead' };
          }
          if (sel.includes('job-details-jobs-unified-top-card__company-name')) {
            return { textContent: 'Figma' };
          }
          if (sel === '#job-details') {
            return {
              innerHTML: '<p>Looking for a Full Stack Lead to architect high-scale web collaboration engines.</p>',
              querySelectorAll: () => [],
            };
          }
          return null;
        },
      };

      const job = contentScript.detectJob(fakeDoc);
      expect(job.detected).toBe(true);
      expect(job.title).toBe('Full Stack Tech Lead');
      expect(job.company).toBe('Figma');
      expect(job.fullDescription).toContain('Full Stack Lead');
      expect(job.wordCount).toBeGreaterThan(5);
      expect(job.charCount).toBeGreaterThan(20);
      expect(job.capturedAt).toBeDefined();
    });

    it('should handle highlightCapturedElement gracefully without crashing', () => {
      let scrolled = false;
      let addedClass = null;

      const mockTarget = {
        scrollIntoView: (opts) => {
          scrolled = true;
          expect(opts.behavior).toBe('smooth');
        },
        classList: {
          add: (cls) => {
            addedClass = cls;
          },
          remove: () => {},
        },
      };

      contentScript.highlightCapturedElement(mockTarget);
      expect(scrolled).toBe(true);
      expect(addedClass).toBe('applyforge-highlight-pulse');
    });
  });

  describe('Phase 106 Popup UI & Capture Controller', () => {
    const popupController = require('../../../extension/popup.js');
    const popupHtmlPath = path.join(EXTENSION_DIR, 'popup.html');
    let popupHtml;

    beforeAll(() => {
      popupHtml = fs.readFileSync(popupHtmlPath, 'utf8');
    });

    it('should include the Send to ApplyForge button with correct ID and text', () => {
      expect(popupHtml).toContain('id="send-to-applyforge-btn"');
      expect(popupHtml).toContain('Send to ApplyForge');
    });

    it('should include JD textarea and character/word counters', () => {
      expect(popupHtml).toContain('id="job-desc-textarea"');
      expect(popupHtml).toContain('id="job-word-count"');
      expect(popupHtml).toContain('id="job-char-count"');
    });

    it('should include Full JD and Selected Text tabs', () => {
      expect(popupHtml).toContain('id="tab-full-jd"');
      expect(popupHtml).toContain('id="tab-selection-jd"');
    });

    it('should include on-page highlighting and copy text buttons', () => {
      expect(popupHtml).toContain('id="highlight-on-page-btn"');
      expect(popupHtml).toContain('id="copy-jd-btn"');
    });

    it('should export calculateWordCount in popup.js', () => {
      expect(popupController.calculateWordCount).toBeDefined();
      expect(popupController.calculateWordCount('Senior Frontend React Developer')).toBe(4);
      expect(popupController.calculateWordCount('')).toBe(0);
    });

    it('should handle renderJobCard for undetected jobs cleanly', () => {
      expect(() => {
        popupController.renderJobCard(null);
        popupController.renderJobCard({ detected: false });
      }).not.toThrow();
    });
  });

  describe('Phase 106 Backend /api/jd Route & Model Compatibility', () => {
    it('should allow extension as a valid source in JobDescription model schema', () => {
      const JobDescription = require('../../src/models/JobDescription');
      const sourceEnum = JobDescription.schema.path('source').enumValues;
      expect(sourceEnum).toContain('extension');
      expect(sourceEnum).toContain('paste');
      expect(sourceEnum).toContain('url');
    });
  });
});

