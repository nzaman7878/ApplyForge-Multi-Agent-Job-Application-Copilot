import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from './test-utils';
import FollowUpDraftModal from '../components/tracker/FollowUpDraftModal';
import api from '../lib/axios';

vi.mock('../lib/axios', () => ({
  default: {
    post: vi.fn(),
    patch: vi.fn(),
    get: vi.fn(),
  },
}));

const mockToast = {
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
};

vi.mock('../hooks/useToast', () => ({
  useToast: () => mockToast,
}));

describe('FollowUpDraftModal Component (Phase 109)', () => {
  const sampleAppWithDraft = {
    _id: 'app-stripe-123',
    id: 'app-stripe-123',
    company: 'Stripe',
    roleTitle: 'Staff Backend Infrastructure',
    status: 'applied',
    appliedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    followUpEmail: {
      subject: 'Status Inquiry: Staff Backend Infrastructure Application - Alex Dev',
      body: 'Dear Hiring Team at Stripe,\n\nI am following up on my application for the Staff Backend Infrastructure role submitted 10 days ago.\n\nBest regards,\nAlex Dev',
      strategy: 'standard_status_inquiry',
      recommendedSendTime: 'Tuesday or Wednesday morning between 9:00 AM - 11:00 AM',
      recommendedWaitDays: 5,
      keyHighlights: ['Staff Backend Infrastructure domain expertise', 'Kafka & Go pipeline impact'],
      tone: 'professional',
      daysSinceApplied: 10,
    },
  };

  const sampleAppWithoutDraft = {
    _id: 'app-datadog-456',
    id: 'app-datadog-456',
    company: 'Datadog',
    roleTitle: 'Senior Distributed Systems Engineer',
    status: 'interviewing',
    appliedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render anything when isOpen is false', () => {
    renderWithProviders(
      <FollowUpDraftModal
        isOpen={false}
        onClose={vi.fn()}
        application={sampleAppWithDraft}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render application details and pre-existing follow-up draft', () => {
    renderWithProviders(
      <FollowUpDraftModal
        isOpen={true}
        onClose={vi.fn()}
        application={sampleAppWithDraft}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Follow-Up Email Draft')).toBeInTheDocument();
    expect(screen.getByText('Stripe')).toBeInTheDocument();
    expect(screen.getAllByText(/Staff Backend Infrastructure/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Standard Status Inquiry')).toBeInTheDocument();
    expect(screen.getByText(/Best time: Tuesday or Wednesday morning/i)).toBeInTheDocument();

    // Verify key highlights
    expect(screen.getByText(/Kafka & Go pipeline impact/i)).toBeInTheDocument();

    // Verify inputs have loaded draft values
    const subjectInput = screen.getByLabelText(/Subject Line/i);
    expect(subjectInput).toHaveValue(sampleAppWithDraft.followUpEmail.subject);

    const bodyTextarea = screen.getByLabelText(/Email Body/i);
    expect(bodyTextarea).toHaveValue(sampleAppWithDraft.followUpEmail.body);
  });

  it('should auto-generate follow-up draft when opening an application without an existing draft', async () => {
    const generatedDraft = {
      subject: 'Thank You & Follow-Up: Senior Distributed Systems Engineer - Candidate',
      body: 'Dear Datadog Team,\n\nThank you for the conversation regarding the engineering priorities.',
      strategy: 'post_interview_reinforcement',
      recommendedSendTime: 'Thursday morning between 9:00 AM - 11:00 AM',
      recommendedWaitDays: 3,
      keyHighlights: ['Distributed Systems alignment'],
      tone: 'professional',
    };

    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        emailDraft: generatedDraft,
      },
    });

    renderWithProviders(
      <FollowUpDraftModal
        isOpen={true}
        onClose={vi.fn()}
        application={sampleAppWithoutDraft}
      />
    );

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith(
        '/api/applications/app-datadog-456/draft-followup',
        expect.objectContaining({
          tone: 'professional',
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByLabelText(/Subject Line/i)).toHaveValue(generatedDraft.subject);
      expect(screen.getByLabelText(/Email Body/i)).toHaveValue(generatedDraft.body);
      expect(screen.getByText('Post-Interview Reinforcement')).toBeInTheDocument();
    });
  });

  it('should allow user to edit subject line and email body', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <FollowUpDraftModal
        isOpen={true}
        onClose={vi.fn()}
        application={sampleAppWithDraft}
      />
    );

    const subjectInput = screen.getByLabelText(/Subject Line/i);
    const bodyTextarea = screen.getByLabelText(/Email Body/i);

    // Edit subject
    await user.clear(subjectInput);
    await user.type(subjectInput, 'Custom Follow-Up: Checking in on Stripe application');
    expect(subjectInput).toHaveValue('Custom Follow-Up: Checking in on Stripe application');

    // Edit body
    await user.clear(bodyTextarea);
    await user.type(bodyTextarea, 'Hi Sarah,\n\nChecking in on the infra team search!');
    expect(bodyTextarea).toHaveValue('Hi Sarah,\n\nChecking in on the infra team search!');
  });

  it('should copy full email to clipboard when "Copy Full Email" is clicked', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');

    renderWithProviders(
      <FollowUpDraftModal
        isOpen={true}
        onClose={vi.fn()}
        application={sampleAppWithDraft}
      />
    );

    const copyAllBtn = screen.getByRole('button', { name: /Copy Full Email/i });
    await user.click(copyAllBtn);

    expect(writeTextSpy).toHaveBeenCalledWith(
      `Subject: ${sampleAppWithDraft.followUpEmail.subject}\n\n${sampleAppWithDraft.followUpEmail.body}`
    );
    expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Copied Full email'));
    expect(screen.getByRole('button', { name: /Copied to Clipboard!/i })).toBeInTheDocument();
  });

  it('should copy subject and body individually to clipboard', async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, 'writeText');

    renderWithProviders(
      <FollowUpDraftModal
        isOpen={true}
        onClose={vi.fn()}
        application={sampleAppWithDraft}
      />
    );

    // Copy Subject
    const copySubjectBtn = screen.getByRole('button', { name: /Copy Subject/i });
    await user.click(copySubjectBtn);
    expect(writeTextSpy).toHaveBeenCalledWith(sampleAppWithDraft.followUpEmail.subject);
    expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Copied Subject line'));

    // Copy Body
    const copyBodyBtn = screen.getByRole('button', { name: /Copy Body/i });
    await user.click(copyBodyBtn);
    expect(writeTextSpy).toHaveBeenCalledWith(sampleAppWithDraft.followUpEmail.body);
    expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('Copied Email body'));
  });

  it('should support customizing AI directives and re-generating draft', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <FollowUpDraftModal
        isOpen={true}
        onClose={vi.fn()}
        application={sampleAppWithDraft}
      />
    );

    // Expand directives panel
    const toggleBtn = screen.getByRole('button', { name: /AI Guidance & Fine-Tuning Directives/i });
    await user.click(toggleBtn);

    expect(screen.getByLabelText(/Recipient Name/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tone Preset/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Specific Details/i)).toBeInTheDocument();

    // Fill customized directives
    await user.type(screen.getByLabelText(/Recipient Name/i), 'Jordan Lee (Lead Recruiter)');
    await user.selectOptions(screen.getByLabelText(/Tone Preset/i), 'enthusiastic');
    await user.type(screen.getByLabelText(/Specific Details/i), 'Discussed GraphQL microservices on Tuesday');

    // Mock API response for regeneration
    api.post.mockResolvedValueOnce({
      data: {
        success: true,
        emailDraft: {
          subject: 'Enthusiastic Follow-up: Jordan Lee & Stripe Infrastructure',
          body: 'Hi Jordan,\n\nStill buzzing from our chat about GraphQL microservices!',
          strategy: 'standard_status_inquiry',
          recommendedSendTime: 'Wednesday morning',
          recommendedWaitDays: 5,
        },
      },
    });

    const regenBtn = screen.getByRole('button', { name: /Generate Tailored Draft/i });
    await user.click(regenBtn);

    expect(api.post).toHaveBeenCalledWith(
      '/api/applications/app-stripe-123/draft-followup',
      expect.objectContaining({
        recipientName: 'Jordan Lee (Lead Recruiter)',
        tone: 'enthusiastic',
        customNotes: 'Discussed GraphQL microservices on Tuesday',
      })
    );

    await waitFor(() => {
      expect(screen.getByLabelText(/Subject Line/i)).toHaveValue(
        'Enthusiastic Follow-up: Jordan Lee & Stripe Infrastructure'
      );
    });
  });

  it('should save manual draft edits via PATCH /api/applications/:id', async () => {
    const user = userEvent.setup();
    const onDraftSaved = vi.fn();

    api.patch.mockResolvedValueOnce({
      data: {
        message: 'Application updated successfully',
        application: { ...sampleAppWithDraft },
      },
    });

    renderWithProviders(
      <FollowUpDraftModal
        isOpen={true}
        onClose={vi.fn()}
        application={sampleAppWithDraft}
        onDraftSaved={onDraftSaved}
      />
    );

    const subjectInput = screen.getByLabelText(/Subject Line/i);
    await user.clear(subjectInput);
    await user.type(subjectInput, 'Updated Subject for Stripe');

    const saveBtn = screen.getByRole('button', { name: /Save Draft/i });
    await user.click(saveBtn);

    expect(api.patch).toHaveBeenCalledWith(
      '/api/applications/app-stripe-123',
      expect.objectContaining({
        followUpEmail: expect.objectContaining({
          subject: 'Updated Subject for Stripe',
        }),
      })
    );

    await waitFor(() => {
      expect(mockToast.success).toHaveBeenCalledWith(expect.stringContaining('changes saved'));
      expect(onDraftSaved).toHaveBeenCalled();
    });
  });

  it('should mark follow-up as completed and close modal', async () => {
    const user = userEvent.setup();
    const onMarkFollowedUp = vi.fn().mockResolvedValueOnce();
    const onClose = vi.fn();

    renderWithProviders(
      <FollowUpDraftModal
        isOpen={true}
        onClose={onClose}
        application={sampleAppWithDraft}
        onMarkFollowedUp={onMarkFollowedUp}
      />
    );

    const markBtn = screen.getByRole('button', { name: /Mark Followed-Up/i });
    await user.click(markBtn);

    expect(onMarkFollowedUp).toHaveBeenCalledWith('app-stripe-123');
    expect(onClose).toHaveBeenCalled();
  });

  it('should close dialog when clicking Close or Close button (X)', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithProviders(
      <FollowUpDraftModal
        isOpen={true}
        onClose={onClose}
        application={sampleAppWithDraft}
      />
    );

    const closeBtn = screen.getByRole('button', { name: /Close dialog/i });
    await user.click(closeBtn);

    expect(onClose).toHaveBeenCalled();
  });
});
