import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulletsEditor from '../components/review/BulletsEditor';
import { renderWithProviders } from './test-utils';

describe('BulletsEditor Component', () => {
  const sampleBullets = [
    {
      originalBullet: 'Built microservices with Node.js and improved API speed.',
      tailoredBullet:
        'Architected event-driven microservices with Node.js and Redis, reducing latency by 42% for 2M active users.',
      reasoning: 'Quantified performance gains and highlighted Redis caching.',
    },
    {
      originalBullet: 'Worked on React frontend components with Tailwind.',
      tailoredBullet:
        'Developed responsive, accessible React and Tailwind CSS UI components with 98% test coverage.',
      reasoning: 'Added test coverage metric and emphasized accessibility standards.',
    },
  ];

  it('renders empty state when no bullets are provided', () => {
    renderWithProviders(<BulletsEditor bullets={[]} />);
    expect(
      screen.getByText(/No Tailored Bullets Available/i)
    ).toBeInTheDocument();
  });

  it('renders side-by-side original and tailored bullets', () => {
    renderWithProviders(<BulletsEditor bullets={sampleBullets} />);

    expect(
      screen.getByText(/Built microservices with Node.js and improved API speed/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Architected event-driven microservices with Node.js and Redis/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Quantified performance gains/i)
    ).toBeInTheDocument();

    expect(screen.getAllByText(/Pending Review/i).length).toBe(2);
  });

  it('accepts an individual bullet and updates badge and buttons', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    renderWithProviders(
      <BulletsEditor bullets={sampleBullets} onChange={handleChange} />
    );

    const acceptButton = screen.getByLabelText(
      /Accept AI tailored optimization for bullet #1/i
    );
    await user.click(acceptButton);

    expect(screen.getAllByText('Accepted').length).toBeGreaterThanOrEqual(1);
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'accepted',
          tailoredBullet: expect.stringContaining('Architected event-driven microservices'),
        }),
      ])
    );
  });

  it('rejects an individual bullet and marks it as using original', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    renderWithProviders(
      <BulletsEditor bullets={sampleBullets} onChange={handleChange} />
    );

    const rejectButton = screen.getByLabelText(
      /Reject AI version and keep original bullet #1/i
    );
    await user.click(rejectButton);

    expect(screen.getByText('Rejected (Using Original)')).toBeInTheDocument();
    expect(screen.getByText('Active Choice')).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'rejected',
          tailoredBullet: expect.stringContaining('Built microservices with Node.js'),
        }),
      ])
    );
  });

  it('supports inline editing and saves custom edits', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    renderWithProviders(
      <BulletsEditor bullets={sampleBullets} onChange={handleChange} />
    );

    const editButton = screen.getByLabelText(/Edit bullet #1 inline/i);
    await user.click(editButton);

    const textarea = screen.getByPlaceholderText(/Edit your tailored achievement bullet/i);
    expect(textarea).toBeInTheDocument();

    await user.clear(textarea);
    await user.type(textarea, 'Customized bullet point with unique metrics.');

    const saveButton = screen.getByRole('button', { name: /Save edited bullet #1/i });
    await user.click(saveButton);

    expect(screen.getByText('Custom Edited')).toBeInTheDocument();
    expect(
      screen.getByText('Customized bullet point with unique metrics.')
    ).toBeInTheDocument();
    expect(handleChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'edited',
          tailoredBullet: 'Customized bullet point with unique metrics.',
        }),
      ])
    );
  });

  it('cancels inline editing without changing the bullet text', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BulletsEditor bullets={sampleBullets} />);

    const editButton = screen.getByLabelText(/Edit bullet #1 inline/i);
    await user.click(editButton);

    const textarea = screen.getByPlaceholderText(/Edit your tailored achievement bullet/i);
    await user.type(textarea, ' Extra text that should be cancelled');

    const cancelButton = screen.getByRole('button', { name: /Cancel editing bullet #1/i });
    await user.click(cancelButton);

    expect(
      screen.queryByPlaceholderText(/Edit your tailored achievement bullet/i)
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/Architected event-driven microservices/i)
    ).toBeInTheDocument();
  });

  it('supports batch actions (Accept All and Revert All)', async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();

    renderWithProviders(
      <BulletsEditor bullets={sampleBullets} onChange={handleChange} />
    );

    const acceptAllBtn = screen.getByRole('button', { name: /Accept all 2 tailored bullets/i });
    await user.click(acceptAllBtn);

    expect(screen.getAllByText('Accepted').length).toBeGreaterThanOrEqual(2);
    expect(handleChange).toHaveBeenCalled();

    const revertAllBtn = screen.getByRole('button', {
      name: /Revert all bullets to original resume text/i,
    });
    await user.click(revertAllBtn);

    expect(screen.getAllByText('Rejected (Using Original)').length).toBe(2);
  });
});
