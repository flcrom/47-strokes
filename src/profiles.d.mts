export const profiles: {
  id: string;
  name: string;
  hint: string;
  prefix: string;
  link?: boolean;
  help?: string;
}[];
export function profileURL(id: string, value: string): string;
