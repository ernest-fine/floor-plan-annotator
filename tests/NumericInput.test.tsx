// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import NumericInput, { type NumericInputProps } from '@/shared/ui/NumericInput';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
let changes: string[];

function Harness({ value = '', ...props }: Partial<NumericInputProps>) {
  const [draft, setDraft] = useState(value);
  return (
    <NumericInput
      aria-label="SNR reading 1"
      {...props}
      value={draft}
      onValueChange={(next) => {
        changes.push(next);
        setDraft(next);
      }}
    />
  );
}

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  changes = [];
});

afterEach(async () => {
  await act(() => root.unmount());
  host.remove();
});

async function render(props: Partial<NumericInputProps> = {}) {
  await act(() => root.render(<Harness {...props} />));
}

const input = () => host.querySelector('input')!;

async function enter(value: string) {
  // Bypass React's value tracker just as a browser edit or paste would.
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(() => {
    setValue.call(input(), value);
    input().dispatchEvent(new Event('input', { bubbles: true }));
  });
}

describe('NumericInput', () => {
  it('accepts unsigned decimal drafts while preserving their exact text', async () => {
    await render();
    for (const draft of ['.', '.5', '0.', '00.50', '42', '']) {
      await enter(draft);
      expect(input().value).toBe(draft);
    }
    expect(changes).toEqual(['.', '.5', '0.', '00.50', '42', '']);
    expect(input().type).toBe('text');
    expect(input().inputMode).toBe('decimal');
    expect(input().getAttribute('aria-label')).toBe('SNR reading 1');
  });

  it.each(['abc', '1e3', '1E-3', 'NaN', 'Infinity', '-Infinity', '1.2.3', '--2', '2-3', '+3', ' 3 ', '-', '-2']) (
    'rejects invalid unsigned edit or paste %j and restores the controlled value',
    async (value) => {
      await render({ value: '12.5' });
      await enter(value);
      expect(changes).toEqual([]);
      expect(input().value).toBe('12.5');
    },
  );

  it('accepts signed drafts and negative decimal pastes when enabled', async () => {
    await render({ allowNegative: true });
    for (const draft of ['-', '-.', '-.25', '-87.5', '-0.', '']) {
      await enter(draft);
      expect(input().value).toBe(draft);
    }
    expect(changes).toEqual(['-', '-.', '-.25', '-87.5', '-0.', '']);
    await enter('--2');
    await enter('-.2.5');
    expect(input().value).toBe('');
    expect(changes).toHaveLength(6);
  });

  it('renders a decorative fixed prefix outside the editable value', async () => {
    await render({ value: '87', prefix: '−', allowNegative: true, 'aria-label': 'RSSI reading 1' });
    expect(input().value).toBe('87');
    const prefix = host.querySelector('.numeric-input__prefix')!;
    expect(prefix.textContent).toBe('−');
    expect(prefix.getAttribute('aria-hidden')).toBe('true');
    expect(input().contains(prefix)).toBe(false);
    await enter('-92');
    expect(changes).toEqual(['-92']);
    expect(prefix.textContent).toBe('−');
  });

  it('toggles the sign without changing magnitude, including incomplete drafts', async () => {
    await render({ allowNegative: true, showSignToggle: true, value: '02.50' });
    const toggle = host.querySelector('button')!;
    expect(toggle.type).toBe('button');
    expect(toggle.getAttribute('aria-label')).toBe('Toggle sign for SNR reading 1');
    for (const expected of ['-02.50', '02.50']) {
      await act(() => toggle.click());
      expect(input().value).toBe(expected);
    }
    await enter('');
    await act(() => toggle.click());
    expect(input().value).toBe('-');
    await act(() => toggle.click());
    expect(input().value).toBe('');
    await enter('.');
    await act(() => toggle.click());
    expect(input().value).toBe('-.');
  });

  it('does not offer negative sign entry unless negatives are allowed', async () => {
    await render({ showSignToggle: true });
    expect(host.querySelector('button')).toBeNull();
  });

  it('disables both controls and forwards input presentation options', async () => {
    await render({ disabled: true, allowNegative: true, showSignToggle: true, value: '-2', placeholder: 'Signal', inputMode: 'numeric', maxLength: 8 });
    const toggle = host.querySelector('button')!;
    expect(input().disabled).toBe(true);
    expect(toggle.disabled).toBe(true);
    expect(input().placeholder).toBe('Signal');
    expect(input().inputMode).toBe('numeric');
    expect(input().maxLength).toBe(8);
    await act(() => toggle.click());
    expect(changes).toEqual([]);
    expect(input().value).toBe('-2');
  });
});
