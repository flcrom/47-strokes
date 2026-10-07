export const WIDTH:number,HEIGHT:number,COOLDOWN:number;
export type Stroke={id:string;points:number[][];url:string};
export function seed():Stroke[];
export function safeURL(input:string):string;
export function validate(points:number[][],url:string):{points:number[][];url:string};
export function accept(strokes:Stroke[],nextAllowed:number,points:number[][],url:string,now:number):{strokes:Stroke[];nextAllowed:number};
export function remaining(next:number,now:number):string;

export function ageShade(index:number,total?:number):string;

export const MAX_LENGTH:number;
export function pathLength(points:number[][]):number;
export function extendPath(points:number[][],point:number[]):number[][];

export function nearestStroke(strokes:Stroke[],point:number[],radius?:number):Stroke|null;
