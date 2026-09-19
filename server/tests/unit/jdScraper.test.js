const axios = require('axios');
const {
  scrapeJobDescription,
  extractCleanText,
  detectJobBoard,
  getRandomUserAgent,
  getBrowserHeaders,
  USER_AGENTS,
} = require('../../src/services/scraper/jdScraper');

jest.mock('axios');

describe('jdScraper Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('User Agent Rotation & Browser Headers', () => {
    it('should have a rich pool of realistic modern browser user agents', () => {
      expect(Array.isArray(USER_AGENTS)).toBe(true);
      expect(USER_AGENTS.length).toBeGreaterThanOrEqual(8);
      USER_AGENTS.forEach((ua) => {
        expect(typeof ua).toBe('string');
        expect(ua).toMatch(/Mozilla\/5\.0/);
      });
    });

    it('should return a user agent from the pool via getRandomUserAgent', () => {
      const ua = getRandomUserAgent();
      expect(USER_AGENTS).toContain(ua);
    });

    it('should generate realistic browser headers with matching Sec-Ch-Ua platform', () => {
      const macUa =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const macHeaders = getBrowserHeaders(macUa);

      expect(macHeaders['User-Agent']).toBe(macUa);
      expect(macHeaders['Sec-Ch-Ua-Platform']).toBe('"macOS"');
      expect(macHeaders['Sec-Fetch-Dest']).toBe('document');
      expect(macHeaders['Sec-Fetch-Mode']).toBe('navigate');
      expect(macHeaders['Upgrade-Insecure-Requests']).toBe('1');

      const winUa =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const winHeaders = getBrowserHeaders(winUa);
      expect(winHeaders['Sec-Ch-Ua-Platform']).toBe('"Windows"');

      const linuxUa =
        'Mozilla/5.0 (X11; Linux x86_64; rv:123.0) Gecko/20100101 Firefox/123.0';
      const linuxHeaders = getBrowserHeaders(linuxUa);
      expect(linuxHeaders['Sec-Ch-Ua-Platform']).toBe('"Linux"');
    });
  });

  describe('detectJobBoard', () => {
    it('should identify greenhouse job boards', () => {
      expect(detectJobBoard('https://boards.greenhouse.io/anthropic/jobs/12345')).toBe('greenhouse');
      expect(detectJobBoard('https://job-boards.greenhouse.io/stripe/jobs/67890')).toBe('greenhouse');
    });

    it('should identify linkedin job URLs', () => {
      expect(detectJobBoard('https://www.linkedin.com/jobs/view/4100200300/')).toBe('linkedin');
      expect(detectJobBoard('https://linkedin.com/jobs/search/?currentJobId=1234')).toBe('linkedin');
    });

    it('should identify naukri job URLs', () => {
      expect(detectJobBoard('https://www.naukri.com/job-listings-full-stack-engineer-12345')).toBe('naukri');
    });

    it('should fallback to generic for custom employer or unknown domains', () => {
      expect(detectJobBoard('https://careers.google.com/jobs/results/123')).toBe('generic');
      expect(detectJobBoard('https://apply.workable.com/techcorp/j/ABCDE/')).toBe('generic');
    });
  });

  describe('extractCleanText - Board-specific Parsers', () => {
    it('should parse Greenhouse job postings correctly', () => {
      const greenhouseHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Senior AI Engineer - Scale AI</title></head>
          <body>
            <div id="wrapper">
              <h1 class="app-title">Staff Machine Learning Engineer</h1>
              <span class="company-name">at Anthropic</span>
              <div class="location">San Francisco, CA (Hybrid)</div>
              <div id="content">
                <p>Anthropic is an AI safety and research company.</p>
                <h3>What you'll do:</h3>
                <ul>
                  <li>Train and evaluate large language models.</li>
                  <li>Build high-throughput RLHF pipelines.</li>
                </ul>
                <h3>Qualifications:</h3>
                <ul>
                  <li>5+ years of experience with PyTorch, distributed training, and CUDA.</li>
                </ul>
              </div>
            </div>
          </body>
        </html>
      `;

      const result = extractCleanText(greenhouseHtml, 'https://boards.greenhouse.io/anthropic/jobs/123');

      expect(result.board).toBe('greenhouse');
      expect(result.roleTitle).toBe('Staff Machine Learning Engineer');
      expect(result.company).toBe('Anthropic');
      expect(result.location).toContain('San Francisco');
      expect(result.text).toContain('Train and evaluate large language models');
      expect(result.text).toContain('5+ years of experience with PyTorch');
    });

    it('should parse LinkedIn job postings and strip UI clutter', () => {
      const linkedinHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Principal Software Engineer | Snowflake | LinkedIn</title></head>
          <body>
            <div class="top-card-layout__entity-info">
              <h1 class="top-card-layout__title">Principal Software Engineer</h1>
              <a class="topcard__org-name-link" href="#">Snowflake</a>
              <span class="topcard__flavor--bullet">Seattle, WA</span>
            </div>
            <div class="description__text description__text--rich">
              <p>About Snowflake: We are building the Data Cloud.</p>
              <p>Key requirements:</p>
              <ul>
                <li>Deep expertise in distributed systems, C++, and Go.</li>
                <li>Experience scaling multi-tenant database engines.</li>
              </ul>
              <button class="show-more-less-html__button">Show more</button>
              <div class="report-job">Report this job</div>
            </div>
          </body>
        </html>
      `;

      const result = extractCleanText(linkedinHtml, 'https://www.linkedin.com/jobs/view/99887766');

      expect(result.board).toBe('linkedin');
      expect(result.roleTitle).toBe('Principal Software Engineer');
      expect(result.company).toBe('Snowflake');
      expect(result.location).toContain('Seattle');
      expect(result.text).toContain('Deep expertise in distributed systems');
      expect(result.text).not.toContain('Show more');
      expect(result.text).not.toContain('Report this job');
    });

    it('should parse Naukri job postings and remove recruiter & disclaimer noise', () => {
      const naukriHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Full Stack Lead - Flipkart - Bengaluru</title></head>
          <body>
            <div class="styles_job-header__container">
              <h1 class="styles_jd-header-title__test">Full Stack Lead Developer</h1>
              <div class="styles_jd-header-comp-name__test"><a href="#">Flipkart Internet</a></div>
              <span class="styles_jhc__location__test">Bengaluru, Karnataka</span>
            </div>
            <div class="styles_job-desc-container__test">
              <p>Role Summary: Lead high-scale web platform initiatives.</p>
              <div class="styles_key-skill__test">
                <span>React</span><span>Node.js</span><span>AWS</span>
              </div>
              <p>Recruiter details: recruiter@flipkart.com</p>
              <p>Beware of fraudulent job offers! Naukri never charges candidates.</p>
            </div>
          </body>
        </html>
      `;

      const result = extractCleanText(naukriHtml, 'https://www.naukri.com/job-listings-flipkart-12345');

      expect(result.board).toBe('naukri');
      expect(result.roleTitle).toBe('Full Stack Lead Developer');
      expect(result.company).toBe('Flipkart Internet');
      expect(result.location).toContain('Bengaluru');
      expect(result.text).toContain('Lead high-scale web platform initiatives');
      expect(result.text).toContain('React Node.js AWS');
      expect(result.text).not.toContain('recruiter@flipkart.com');
      expect(result.text).not.toContain('Beware of fraudulent job offers');
    });

    it('should extract structured details from Schema.org JSON-LD on generic job sites', () => {
      const genericLdJsonHtml = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Careers at Stripe - Staff Infrastructure Engineer</title>
            <script type="application/ld+json">
              {
                "@context": "https://schema.org/",
                "@type": "JobPosting",
                "title": "Staff Infrastructure Engineer",
                "hiringOrganization": {
                  "@type": "Organization",
                  "name": "Stripe"
                },
                "jobLocation": {
                  "@type": "Place",
                  "address": {
                    "addressLocality": "Dublin",
                    "addressCountry": "Ireland"
                  }
                },
                "description": "<p>We are seeking a Staff Infrastructure Engineer to scale our global financial primitives.</p><p>Requires 8+ years experience with Kubernetes, Go, and Kafka.</p>"
              }
            </script>
          </head>
          <body>
            <div class="unrelated-wrapper">Global Site Content</div>
          </body>
        </html>
      `;

      const result = extractCleanText(genericLdJsonHtml, 'https://stripe.com/jobs/infra-123');

      expect(result.board).toBe('generic');
      expect(result.roleTitle).toBe('Staff Infrastructure Engineer');
      expect(result.company).toBe('Stripe');
      expect(result.location).toContain('Dublin');
      expect(result.text).toContain('Staff Infrastructure Engineer to scale our global financial primitives');
      expect(result.text).toContain('8+ years experience with Kubernetes, Go, and Kafka');
    });

    it('should gracefully handle empty, null, or invalid inputs', () => {
      expect(extractCleanText(null)).toEqual({
        text: '',
        title: '',
        company: '',
        roleTitle: '',
        location: '',
        board: 'generic',
      });
      expect(extractCleanText('')).toEqual({
        text: '',
        title: '',
        company: '',
        roleTitle: '',
        location: '',
        board: 'generic',
      });
    });
  });

  describe('scrapeJobDescription HTTP Fetching & Retries', () => {
    it('should throw an error if URL does not have http or https protocol', async () => {
      await expect(scrapeJobDescription('www.example.com/job/123')).rejects.toThrow(
        /http:\/\/ or https:\/\//
      );
      await expect(scrapeJobDescription('')).rejects.toThrow(
        /http:\/\/ or https:\/\//
      );
    });

    it('should successfully fetch, parse, and return job posting data when axios succeeds', async () => {
      const mockHtml = `
        <!DOCTYPE html>
        <html>
          <head><title>Cloud Architect - Google Careers</title></head>
          <body>
            <main>
              <h1>Senior Cloud Solutions Architect</h1>
              <p>Join Google Cloud to design resilient multi-region architectures.</p>
              <p>Experience required with GCP, Terraform, and Kubernetes.</p>
            </main>
          </body>
        </html>
      `;

      axios.get.mockResolvedValueOnce({
        status: 200,
        data: mockHtml,
      });

      const result = await scrapeJobDescription('https://careers.google.com/jobs/12345');

      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(result.url).toBe('https://careers.google.com/jobs/12345');
      expect(result.rawText).toContain('Senior Cloud Solutions Architect');
      expect(result.rawText).toContain('GCP, Terraform, and Kubernetes');
      expect(result.board).toBe('generic');
    });

    it('should reject with descriptive error if axios response fails with 404', async () => {
      const notFoundError = new Error('Request failed with status code 404');
      notFoundError.response = {
        status: 404,
        statusText: 'Not Found',
      };

      axios.get.mockRejectedValueOnce(notFoundError);

      await expect(
        scrapeJobDescription('https://careers.example.com/missing-job')
      ).rejects.toThrow(/HTTP 404/);
    });
  });
});
