// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExperiencePanels } from './ExperiencePanels';

describe('ExperiencePanels', () => {
  it('renders an artifact and explicit question/permission controls', async () => {
    const onAnswer = vi.fn(async () => {});
    const onPermission = vi.fn(async () => {});
    render(<ExperiencePanels
      artifact={{ id: 'artifact-1', view: 'desktop-artifact', loading: false, content: 'diff --git a/file b/file' }}
      questions={[{ requestId: 'q1', prompts: [{ text: 'Proceed?', options: ['Yes', 'No'], multiple: false }] }]}
      permissions={[{ requestId: 'p1', title: 'shell', detail: 'npm test' }]}
      interactionError=""
      disabled={false}
      onAnswer={onAnswer}
      onPermission={onPermission}
    />);

    expect(screen.getByText('diff --git a/file b/file')).toBeTruthy();
    fireEvent.click(screen.getAllByRole('button', { name: 'Yes' }).at(-1)!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Answer' }).at(-1)!);
    expect(onAnswer).toHaveBeenCalledWith('q1', [['Yes']]);
    fireEvent.click(screen.getByRole('button', { name: 'Allow once' }));
    expect(onPermission).toHaveBeenCalledWith('p1', 'once');
    expect(screen.getByRole('button', { name: 'Always allow' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy();
  });

  it('preserves multiple-choice and multi-answer fidelity', async () => {
    const onAnswer = vi.fn(async () => {});
    render(<ExperiencePanels
      artifact={null}
      questions={[{ requestId: 'q-multi', prompts: [
        { text: 'Targets?', options: ['Desktop', 'TUI', 'PTY'], multiple: true },
        { text: 'Ship?', options: ['Yes', 'No'], multiple: false },
      ] }]}
      permissions={[]} interactionError="" disabled={false}
      onAnswer={onAnswer} onPermission={vi.fn(async () => {})}
    />);

    fireEvent.click(screen.getByRole('button', { name: 'Desktop' }));
    fireEvent.click(screen.getByRole('button', { name: 'PTY' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Yes' }).at(-1)!);
    fireEvent.click(screen.getAllByRole('button', { name: 'Answer' }).at(-1)!);
    expect(onAnswer).toHaveBeenCalledWith('q-multi', [['Desktop', 'PTY'], ['Yes']]);
  });
});
