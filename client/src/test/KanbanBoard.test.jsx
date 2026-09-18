import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KanbanBoard from '../components/tracker/KanbanBoard';
import { renderWithProviders } from './test-utils';

describe('KanbanBoard Component', () => {
  const sampleApplications = [
    {
      id: 'app-1',
      company: 'Google',
      roleTitle: 'Senior Cloud Engineer',
      status: 'wishlist',
      fitScore: { score: 92 },
      appliedAt: '2026-09-10T10:00:00.000Z',
    },
    {
      id: 'app-2',
      company: 'Stripe',
      roleTitle: 'Staff Backend Infrastructure',
      status: 'applied',
      fitScore: { score: 88 },
      appliedAt: '2026-09-12T10:00:00.000Z',
    },
    {
      id: 'app-3',
      company: 'Anthropic',
      roleTitle: 'Systems Architect',
      status: 'interviewing',
      fitScore: { score: 95 },
      appliedAt: '2026-09-14T10:00:00.000Z',
    },
    {
      id: 'app-4',
      company: 'OpenAI',
      roleTitle: 'Kernel Engineer',
      status: 'offer',
      fitScore: { score: 98 },
      appliedAt: '2026-09-15T10:00:00.000Z',
    },
  ];

  it('renders all 5 standard Kanban columns', () => {
    renderWithProviders(<KanbanBoard applications={sampleApplications} />);

    expect(screen.getByRole('heading', { name: 'Drafted', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Applied', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Interviewing', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Rejected', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Offer', level: 3 })).toBeInTheDocument();
  });

  it('groups applications into appropriate columns by status', () => {
    renderWithProviders(<KanbanBoard applications={sampleApplications} />);

    expect(screen.getByText('Google')).toBeInTheDocument();
    expect(screen.getByText('Senior Cloud Engineer')).toBeInTheDocument();

    expect(screen.getByText('Stripe')).toBeInTheDocument();
    expect(screen.getByText('Staff Backend Infrastructure')).toBeInTheDocument();

    expect(screen.getByText('Anthropic')).toBeInTheDocument();
    expect(screen.getByText('Systems Architect')).toBeInTheDocument();

    expect(screen.getByText('OpenAI')).toBeInTheDocument();
    expect(screen.getByText('Kernel Engineer')).toBeInTheDocument();
  });

  it('displays correct fit scores on application cards', () => {
    renderWithProviders(<KanbanBoard applications={sampleApplications} />);

    expect(screen.getByText('92% Strong Fit')).toBeInTheDocument();
    expect(screen.getByText('88% Strong Fit')).toBeInTheDocument();
    expect(screen.getByText('95% Strong Fit')).toBeInTheDocument();
    expect(screen.getByText('98% Strong Fit')).toBeInTheDocument();
  });

  it('allows moving an application to a new stage via status action menu', async () => {
    const user = userEvent.setup();
    const handleStatusChange = vi.fn();

    renderWithProviders(
      <KanbanBoard
        applications={sampleApplications}
        onStatusChange={handleStatusChange}
      />
    );

    // Click the status button on the first card
    const statusButtons = screen.getAllByRole('button', { name: /Edit application status/i });
    await user.click(statusButtons[0]);

    // Expect the move stage menu popover to open
    expect(screen.getByText('Move Stage')).toBeInTheDocument();

    // Click 'Interviewing' from the stage menu
    const interviewingOption = screen.getByRole('button', { name: /Interviewing/i });
    await user.click(interviewingOption);

    // Verify onStatusChange was called with application ID and target status
    expect(handleStatusChange).toHaveBeenCalledTimes(1);
    expect(handleStatusChange).toHaveBeenCalledWith('app-1', 'interviewing');
  });

  it('renders loading overlay when isLoading prop is true', () => {
    const { container } = renderWithProviders(
      <KanbanBoard applications={sampleApplications} isLoading={true} />
    );

    const boardWrapper = container.firstChild;
    expect(boardWrapper).toHaveClass('opacity-60');
    expect(boardWrapper).toHaveClass('pointer-events-none');
  });
});
