import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ATSReport from '../components/review/ATSReport';
import { renderWithProviders } from './test-utils';

describe('ATSReport Component', () => {
  const sampleAtsReport = {
    overallScore: 85,
    matchedKeywords: [
      { keyword: 'React', importance: 'required', location: 'Skills, Experience' },
      { keyword: 'Node.js', importance: 'required', location: 'Skills' },
      { keyword: 'TypeScript', importance: 'preferred', location: 'Experience' },
      { keyword: 'Docker', importance: 'bonus', location: 'Skills' },
    ],
    missingKeywords: [
      {
        keyword: 'Kubernetes',
        importance: 'required',
        suggestion: 'Highlight any container orchestration or cloud deployment projects.',
      },
      {
        keyword: 'GraphQL',
        importance: 'preferred',
        suggestion: 'Mention experience with GraphQL schemas or queries.',
      },
    ],
  };

  it('renders empty state when atsReport is not provided', () => {
    renderWithProviders(<ATSReport atsReport={null} />);
    expect(screen.getByText(/No ATS Report Available/i)).toBeInTheDocument();
  });

  it('renders overall score percentage and Strong Match tier label', () => {
    renderWithProviders(<ATSReport atsReport={sampleAtsReport} />);
    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('Strong Match')).toBeInTheDocument();
  });

  it('renders Moderate Match tier label when score is between 60 and 79', () => {
    const moderateReport = { ...sampleAtsReport, overallScore: 72 };
    renderWithProviders(<ATSReport atsReport={moderateReport} />);
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('Moderate Match')).toBeInTheDocument();
  });

  it('renders Needs Improvement tier label when score is below 60', () => {
    const lowReport = { ...sampleAtsReport, overallScore: 48 };
    renderWithProviders(<ATSReport atsReport={lowReport} />);
    expect(screen.getByText('48')).toBeInTheDocument();
    expect(screen.getByText('Needs Improvement')).toBeInTheDocument();
  });

  it('renders matched keywords with importance badges and locations', () => {
    renderWithProviders(<ATSReport atsReport={sampleAtsReport} />);
    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.getByText('Node.js')).toBeInTheDocument();
    expect(screen.getByText('TypeScript')).toBeInTheDocument();
    expect(screen.getByText('Docker')).toBeInTheDocument();

    expect(screen.getByText('Skills, Experience')).toBeInTheDocument();
  });

  it('renders missing keywords with cross icon and action tip toggle', () => {
    renderWithProviders(<ATSReport atsReport={sampleAtsReport} />);
    expect(screen.getByText('Kubernetes')).toBeInTheDocument();
    expect(screen.getByText('GraphQL')).toBeInTheDocument();

    const actionTips = screen.getAllByText('Action Tip');
    expect(actionTips.length).toBeGreaterThanOrEqual(1);
  });

  it('expands and collapses optimization suggestions on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ATSReport atsReport={sampleAtsReport} />);

    expect(
      screen.queryByText(/Highlight any container orchestration/i)
    ).not.toBeInTheDocument();

    const k8sTipButton = screen.getByLabelText(/Show action tip for keyword Kubernetes/i);
    await user.click(k8sTipButton);

    expect(
      screen.getByText(/Highlight any container orchestration/i)
    ).toBeInTheDocument();

    const hideTipButton = screen.getByLabelText(/Hide action tip for keyword Kubernetes/i);
    await user.click(hideTipButton);

    expect(
      screen.queryByText(/Highlight any container orchestration/i)
    ).not.toBeInTheDocument();
  });

  it('filters keywords via the search input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ATSReport atsReport={sampleAtsReport} />);

    const searchInput = screen.getByPlaceholderText(/Search keywords/i);
    await user.type(searchInput, 'React');

    expect(screen.getByText('React')).toBeInTheDocument();
    expect(screen.queryByText('Node.js')).not.toBeInTheDocument();
    expect(screen.queryByText('Docker')).not.toBeInTheDocument();
  });

  it('filters keywords by importance tabs', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ATSReport atsReport={sampleAtsReport} />);

    const bonusTab = screen.getByRole('button', { name: /Filter by Bonus/i });
    await user.click(bonusTab);

    expect(screen.getByText('Docker')).toBeInTheDocument();
    expect(screen.queryByText('React')).not.toBeInTheDocument();
    expect(screen.queryByText('Kubernetes')).not.toBeInTheDocument();
  });
});
