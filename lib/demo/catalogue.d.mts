export interface DemoSubsection {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
}

export interface DemoSection {
  id: string;
  code: string;
  name: string;
  sortOrder: number;
  subsections: readonly DemoSubsection[];
}

export interface DemoPrototypeItem {
  id: string;
  code: string;
  name: string;
  sectionCode: string;
  prototypeKind: string;
  prototypeOnly: true;
}

export interface DemoCampgroundCatalogue {
  fixtureVersion: number;
  synthetic: true;
  organization: Readonly<{
    id: string;
    name: string;
    slug: string;
  }>;
  campground: Readonly<{
    id: string;
    name: string;
    slug: string;
    timezone: string;
  }>;
  sections: readonly DemoSection[];
  sites: readonly DemoPrototypeItem[];
  cottages: readonly DemoPrototypeItem[];
  assets: readonly DemoPrototypeItem[];
}

export declare const demoCampgroundCatalogue: Readonly<DemoCampgroundCatalogue>;

export declare function validateDemoCampgroundCatalogue(
  catalogue?: DemoCampgroundCatalogue,
): Readonly<{
  fixtureVersion: number;
  sections: number;
  subsections: number;
  sites: number;
  cottages: number;
  assets: number;
}>;

export declare function assertDemoSeedAllowed(
  env?: NodeJS.ProcessEnv,
): string;

export declare const demoCampgroundSummary: Readonly<{
  fixtureVersion: number;
  sections: number;
  subsections: number;
  sites: number;
  cottages: number;
  assets: number;
}>;
