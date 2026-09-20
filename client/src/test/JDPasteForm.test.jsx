import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import JDPasteForm from '../components/jd/JDPasteForm';
import api from '../lib/axios';

vi.mock('../lib/axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../hooks/useToast', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}));

describe('JDPasteForm Component - Scraper UI & Tab Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render default Paste Text mode with sample loader', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JDPasteForm onSuccess={vi.fn()} />);

    expect(screen.getByText('Target Job Description')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Paste Text/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Import from URL/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sample JD/i })).toBeInTheDocument();

    // Click Sample JD
    await user.click(screen.getByRole('button', { name: /Sample JD/i }));

    expect(screen.getByLabelText(/Company Name/i)).toHaveValue('CloudScale Systems');
    expect(screen.getByLabelText(/Role Title/i)).toHaveValue('Senior Full Stack Engineer');
    expect(screen.getByLabelText(/Job Description Content/i).value).toContain('Senior Full Stack Engineer');
  });

  it('should switch between Paste Text and Import from URL tabs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JDPasteForm onSuccess={vi.fn()} />);

    // Initially in paste mode
    expect(screen.queryByPlaceholderText(/https:\/\/boards\.greenhouse\.io/i)).not.toBeInTheDocument();

    // Switch to URL mode
    await user.click(screen.getByRole('button', { name: /Import from URL/i }));

    expect(screen.getByPlaceholderText(/https:\/\/boards\.greenhouse\.io/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Fetch & Extract JD/i })).toBeInTheDocument();
    expect(screen.getByText('LinkedIn')).toBeInTheDocument();
    expect(screen.getByText('Greenhouse')).toBeInTheDocument();
    expect(screen.getByText('Naukri')).toBeInTheDocument();
  });

  it('should show validation error when attempting to scrape an invalid or empty URL', async () => {
    const user = userEvent.setup();
    renderWithProviders(<JDPasteForm onSuccess={vi.fn()} />);

    // Switch to URL mode
    await user.click(screen.getByRole('button', { name: /Import from URL/i }));

    const fetchBtn = screen.getByRole('button', { name: /Fetch & Extract JD/i });
    expect(fetchBtn).toBeDisabled();

    // Enter invalid URL format
    const urlInput = screen.getByPlaceholderText(/https:\/\/boards\.greenhouse\.io/i);
    await user.type(urlInput, 'ftp://invalid-url.com');
    await user.click(fetchBtn);

    expect(screen.getByText(/URL must begin with http:\/\/ or https:\/\//i)).toBeInTheDocument();
  });

  it('should show scraping progress and populate editable form fields on successful scrape', async () => {
    const user = userEvent.setup();
    const mockScrapedResponse = {
      data: {
        success: true,
        preview: true,
        company: 'Stripe',
        roleTitle: 'Staff Infrastructure Engineer',
        rawText:
          'Stripe is seeking an experienced Staff Infrastructure Engineer to lead distributed ledger systems. Requires Kubernetes, Go, and Kafka experience.',
        board: 'greenhouse',
        location: 'Remote, US',
        url: 'https://boards.greenhouse.io/stripe/jobs/12345',
      },
    };

    api.post.mockResolvedValueOnce(mockScrapedResponse);

    renderWithProviders(<JDPasteForm onSuccess={vi.fn()} />);

    // Switch to URL mode
    await user.click(screen.getByRole('button', { name: /Import from URL/i }));

    const urlInput = screen.getByPlaceholderText(/https:\/\/boards\.greenhouse\.io/i);
    await user.type(urlInput, 'https://boards.greenhouse.io/stripe/jobs/12345');

    // Click Fetch & Extract JD
    const fetchBtn = screen.getByRole('button', { name: /Fetch & Extract JD/i });
    await user.click(fetchBtn);

    // Verify API called with preview: true
    expect(api.post).toHaveBeenCalledWith('/api/jds/from-url', {
      url: 'https://boards.greenhouse.io/stripe/jobs/12345',
      preview: true,
    });

    // Verify extracted status banner appears
    await waitFor(() => {
      expect(screen.getByText(/Job Details Extracted/i)).toBeInTheDocument();
      expect(screen.getAllByText(/greenhouse/i).length).toBeGreaterThanOrEqual(2);
    });

    // Verify pre-filled inputs
    const companyInput = screen.getByLabelText(/Company Name/i);
    const roleInput = screen.getByLabelText(/Role Title/i);
    const rawTextInput = screen.getByLabelText(/Job Description Content/i);

    expect(companyInput).toHaveValue('Stripe');
    expect(roleInput).toHaveValue('Staff Infrastructure Engineer');
    expect(rawTextInput.value).toContain('Staff Infrastructure Engineer to lead distributed ledger systems');
  });

  it('should allow user to edit scraped fields before submitting and pass edited data to onSuccess', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();

    // 1. Mock scraping preview
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        preview: true,
        company: 'Anthropic AI',
        roleTitle: 'Research Engineer',
        rawText: 'Join Anthropic to train foundation models. Deep learning and PyTorch required.',
        board: 'greenhouse',
        url: 'https://boards.greenhouse.io/anthropic/jobs/999',
      },
    });

    // 2. Mock final save
    api.post.mockResolvedValueOnce({
      data: {
        jobDescription: {
          id: 'jd-12345',
          company: 'Anthropic PBC',
          roleTitle: 'Lead Research Scientist',
          rawText: 'Join Anthropic to train foundation models. Deep learning and PyTorch required. Additional edited requirement: CUDA optimization.',
          source: 'url',
          sourceUrl: 'https://boards.greenhouse.io/anthropic/jobs/999',
        },
      },
    });

    renderWithProviders(<JDPasteForm onSuccess={handleSuccess} />);

    // Switch to URL mode and fetch
    await user.click(screen.getByRole('button', { name: /Import from URL/i }));
    const urlInput = screen.getByPlaceholderText(/https:\/\/boards\.greenhouse\.io/i);
    await user.type(urlInput, 'https://boards.greenhouse.io/anthropic/jobs/999');
    await user.click(screen.getByRole('button', { name: /Fetch & Extract JD/i }));

    await waitFor(() => {
      expect(screen.getByLabelText(/Company Name/i)).toHaveValue('Anthropic AI');
    });

    // Edit fields before submitting!
    const companyInput = screen.getByLabelText(/Company Name/i);
    const roleInput = screen.getByLabelText(/Role Title/i);
    const rawTextInput = screen.getByLabelText(/Job Description Content/i);

    await user.clear(companyInput);
    await user.type(companyInput, 'Anthropic PBC');

    await user.clear(roleInput);
    await user.type(roleInput, 'Lead Research Scientist');

    await user.type(rawTextInput, ' Additional edited requirement: CUDA optimization.');

    // Submit final edited form
    const submitBtn = screen.getByRole('button', { name: /Parse & Save Job Description/i });
    await user.click(submitBtn);

    // Verify submission payload
    expect(api.post).toHaveBeenLastCalledWith('/api/jds', {
      company: 'Anthropic PBC',
      roleTitle: 'Lead Research Scientist',
      rawText: expect.stringContaining('CUDA optimization'),
      source: 'url',
      sourceUrl: 'https://boards.greenhouse.io/anthropic/jobs/999',
    });

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'jd-12345',
          company: 'Anthropic PBC',
          roleTitle: 'Lead Research Scientist',
        })
      );
    });
  });
});
