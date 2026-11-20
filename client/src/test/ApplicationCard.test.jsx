import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ApplicationCard from '../components/tracker/ApplicationCard';
import KanbanCard from '../components/tracker/KanbanCard';
import { renderWithProviders } from './test-utils';

// Mock dnd-kit sortable
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: { 'aria-describedby': 'DndDescribedBy' },
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

describe('ApplicationCard Component', () => {
  it('renders company name, role title, and initials logo', () => {
    const app = {
      id: 'app-101',
      company: 'Amazon Web Services',
      roleTitle: 'Cloud Architect',
      status: 'applied',
      fitScore: { score: 94 },
      appliedAt: new Date().toISOString(),
    };

    renderWithProviders(<ApplicationCard application={app} />);

    expect(screen.getByText('Amazon Web Services')).toBeInTheDocument();
    expect(screen.getByText('Cloud Architect')).toBeInTheDocument();
    expect(screen.getByText('AW')).toBeInTheDocument();
    expect(screen.getByText('94% Strong Fit')).toBeInTheDocument();
  });

  it('falls back to createdAt when appliedAt is omitted on active applications', () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const app = {
      id: 'app-102',
      company: 'Datadog',
      roleTitle: 'Site Reliability Engineer',
      status: 'interviewing',
      createdAt: threeDaysAgo.toISOString(),
    };

    renderWithProviders(<ApplicationCard application={app} />);

    // Must NOT say Drafted
    expect(screen.queryByText('⏱️ Drafted')).not.toBeInTheDocument();
    expect(screen.getByText(/Applied 3d ago/i)).toBeInTheDocument();
  });

  it('shows Drafted timestamp when application is in wishlist stage without appliedAt', () => {
    const app = {
      id: 'app-103',
      company: 'Figma',
      roleTitle: 'Product Designer',
      status: 'wishlist',
      createdAt: new Date().toISOString(),
    };

    renderWithProviders(<ApplicationCard application={app} />);

    expect(screen.getByText('⏱️ Drafted')).toBeInTheDocument();
  });

  it('opens status transition popover centered above button', async () => {
    const user = userEvent.setup();
    const handleStatusChange = vi.fn();

    const app = {
      id: 'app-104',
      company: 'Vercel',
      roleTitle: 'Frontend Engineer',
      status: 'applied',
    };

    renderWithProviders(
      <ApplicationCard application={app} onStatusChange={handleStatusChange} />
    );

    const statusBtn = screen.getByRole('button', { name: /Edit application status/i });
    await user.click(statusBtn);

    expect(screen.getByText('Move Stage')).toBeInTheDocument();
    const offerOption = screen.getByRole('button', { name: /Offer/i });
    await user.click(offerOption);

    expect(handleStatusChange).toHaveBeenCalledWith('app-104', 'offer');
  });
});

describe('KanbanCard WAI-ARIA Accessibility', () => {
  it('renders wrapper with role="article" avoiding nested interactive controls', () => {
    const app = {
      id: 'app-201',
      company: 'Linear',
      roleTitle: 'Product Engineer',
      status: 'applied',
    };

    renderWithProviders(<KanbanCard application={app} />);

    const article = screen.getByRole('article');
    expect(article).toBeInTheDocument();
    expect(article).toHaveAttribute(
      'aria-label',
      'Application for Product Engineer at Linear'
    );

    // The wrapper itself must not be a button
    expect(screen.queryByRole('button', { name: /Application for Product Engineer at Linear/i })).not.toBeInTheDocument();
  });
});
