import { describe, expect, it } from 'vitest';
import { hardModeLabel } from './objectives';

const boss = (name: string, tags: string[] = []) => ({ name, tags });

describe('hardModeLabel', () => {
  it('uses each raid’s own word for its upgraded version', () => {
    expect(hardModeLabel(boss('Tombs of Amascut', ['raid', 'hard mode']))).toBe('EXPERT MODE');
    expect(hardModeLabel(boss('Chambers of Xeric', ['raid', 'hard mode']))).toBe('CHALLENGE MODE');
  });

  it('calls the Desert Treasure II bosses awakened', () => {
    for (const name of ['The Leviathan', 'The Whisperer', 'Duke Sucellus', 'Vardorvis']) {
      expect(hardModeLabel(boss(name, ['dt2', 'hard mode']))).toBe('AWAKENED');
    }
  });

  it('falls back to hard mode for everything else', () => {
    expect(hardModeLabel(boss('Theatre of Blood', ['raid', 'hard mode']))).toBe('HARD MODE');
    expect(hardModeLabel(boss('The Nightmare', ['hard mode']))).toBe('HARD MODE');
    expect(hardModeLabel(null)).toBe('HARD MODE');
  });

  it('prefers the named raid over the dt2 rule', () => {
    // A boss carrying both should still get its own word, not the group's.
    expect(hardModeLabel(boss('Tombs of Amascut', ['dt2', 'raid']))).toBe('EXPERT MODE');
  });
});
