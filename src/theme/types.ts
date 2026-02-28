/**
 * Floyd Theme Type Definitions
 */

export type ThemeId = 'crush' | 'light';

export interface ExtendedColors {
  coral: string;
  salmon: string;
  cherry: string;
  sriracha: string;
  chili: string;
  bengal: string;
  blush: string;
  violet: string;
  mauve: string;
  grape: string;
  plum: string;
  orchid: string;
  jelly: string;
  hazy: string;
  prince: string;
  urchin: string;
  malibu: string;
  sardine: string;
  damson: string;
  thunder: string;
  anchovy: string;
  sapphire: string;
  guppy: string;
  oceania: string;
  ox: string;
  guac: string;
  julep: string;
  pickle: string;
  gator: string;
  spinach: string;
  citron: string;
  cumin: string;
  tang: string;
  yam: string;
  paprika: string;
  uni: string;
}

export interface RoleColors {
  headerTitle: string;
  headerStatus: string;
  userLabel: string;
  assistantLabel: string;
  systemLabel: string;
  toolLabel: string;
  thinking: string;
  inputPrompt: string;
  hint: string;
}

export interface SyntaxColors {
  keywords: string;
  functions: string;
  strings: string;
  numbers: string;
  comments: string;
  classes: string;
  operators: string;
  punctuation: string;
}

export interface DiffColors {
  addition: {
    lineNumber: string;
    symbol: string;
    background: string;
  };
  deletion: {
    lineNumber: string;
    symbol: string;
    background: string;
  };
}

export interface ThemeColors {
  bg: {
    base: string;
    elevated: string;
    overlay: string;
    modal: string;
  };
  text: {
    primary: string;
    secondary: string;
    tertiary: string;
    subtle: string;
    selected: string;
    inverse: string;
  };
  accent: {
    primary: string;
    secondary: string;
    tertiary: string;
    highlight: string;
    info: string;
  };
  status: {
    ready: string;
    working: string;
    warning: string;
    error: string;
    blocked: string;
    offline: string;
    busy: string;
  };
  extended: ExtendedColors;
  roles: RoleColors;
  syntax: SyntaxColors;
  diff: DiffColors;
}

export interface Theme {
  id: ThemeId;
  name: string;
  colors: ThemeColors;
}
