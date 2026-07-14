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
      questions={[{ requestId: 'q1', prompts: [{ text: 'Proceed?', options: ['Yes', 'No'] }] }]}
      permissions={[{ requestId: 'p1', title: 'shell', detail: 'npm test' }]}
      interactionError=""
      disabled={false}
      onAnswer={onAnswer}
      onPermission={onPermission}
    />);

    expect(screen.getByText('diff --git a/file b/file')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Answer' }));
    expect(onAnswer).toHaveBeenCalledWith('q1', [['Yes']]);
    fireEvent.click(screen.getByRole('button', { name: 'Allow once' }));
    expect(onPermission).toHaveBeenCalledWith('p1', 'once');
    expect(screen.getByRole('button', { name: 'Always allow' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reject' })).toBeTruthy();
  });
});
