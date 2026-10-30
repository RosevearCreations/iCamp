export interface StandardTheme {
  readonly id: "standard";
  readonly label: "Standard";
  readonly style: string;
  readonly version: number;
  readonly background: string;
  readonly tokens: Readonly<Record<string, string>>;
}
export const STANDARD_THEME: StandardTheme;
export const SEMANTIC_STATUS: Readonly<Record<string, string>>;
