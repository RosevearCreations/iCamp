import type { CampgroundModule } from "@/components/management-module-finder";

export type CommandPerspective = "all" | "management" | "it" | "status" | "statistics";
export type CommandCategory = "All tools" | "Bookings" | "Guest services" | "Property" | "Analytics" | "Administration";
export type CommandDensity = "comfortable" | "compact";
export interface CommandView {
  id: string;
  label: string;
  perspective: CommandPerspective;
  category: CommandCategory;
  searchTerm: string;
  density: CommandDensity;
  favoriteHrefs: string[];
  kpiOrder: string[];
  isDefault: boolean;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}
export interface CommandLayoutInput {
  label: string;
  perspective: string;
  category: string;
  searchTerm: string;
  density: string;
  favoriteHrefs: string[];
  kpiOrder: string[];
  isDefault: boolean;
  viewId?: string | null;
  expectedVersion?: number;
}
export function closeCommandViewsPoolForTests(): Promise<void>;
export function getCommandViews(input: {userId:string;campgroundId:string}): Promise<CommandView[]>;
export function normalizeCommandLayout(input: CommandLayoutInput, authorizedModules: CampgroundModule[]): Omit<CommandLayoutInput,"viewId"|"expectedVersion">;
export function saveCommandView(input: {
  userId:string; campgroundId:string; input:CommandLayoutInput; authorizedModules:CampgroundModule[];
}): Promise<{id:string;rowVersion:number}>;
export function deleteCommandView(input:{userId:string;campgroundId:string;viewId:string;expectedVersion:number}):Promise<{id:string}>;
export const commandViewLimits: {views:number;favorites:number;kpis:string[]};
