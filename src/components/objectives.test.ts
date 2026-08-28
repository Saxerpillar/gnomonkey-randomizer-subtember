import { describe, expect, it } from 'vitest';
import { bossObjective, hardModeLabel } from './objectives';

const boss = (name: string, tags: string[] = []) => ({ name, tags });

describe('bossObjective', () => {
  it('scales the depth linearly with the power lever', () => {
    expect(bossObjective('Fortis Colosseum', 0)).toBe('Complete wave 4');
    expect(bossObjective('Fortis Colosseum', 0.25)).toBe('Complete wave 6');
  });

  it('names Sol Heredit from wave 9 up', () => {
    expect(bossObjective('Fortis Colosseum', 0.5)).toBe('Complete wave 8');
    expect(bossObjective('Fortis Colosseum', 0.625)).toBe('Defeat Sol Heredit'); // wave 9
    expect(bossObjective('Fortis Colosseum', 1)).toBe('Defeat Sol Heredit'); // 12
  });

  it('names TzKal-Zuk from wave 58 up', () => {
    expect(bossObjective('The Inferno', 0.5)).toBe('Complete wave 44');
    expect(bossObjective('The Inferno', 0.784)).toBe('Defeat TzKal-Zuk'); // wave 58
    expect(bossObjective('The Inferno', 1)).toBe('Defeat TzKal-Zuk'); // 69
  });

  it('names TzTok-Jad from wave 45 up', () => {
    expect(bossObjective('The Fight Caves', 0.5)).toBe('Complete wave 36');
    expect(bossObjective('The Fight Caves', 0.674)).toBe('Defeat TzTok-Jad'); // wave 45
    expect(bossObjective('The Fight Caves', 1)).toBe('Defeat TzTok-Jad'); // 63
  });

  it('leaves other objectives as plain lines', () => {
    expect(bossObjective('Doom of Mokhaiotl', 0)).toBe('Complete delve 4');
    expect(bossObjective('Doom of Mokhaiotl', 1)).toBe('Complete delve 16');
    expect(bossObjective('Some boss', 1)).toBeNull();
  });
});

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
