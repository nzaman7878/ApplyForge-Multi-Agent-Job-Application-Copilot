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
});
