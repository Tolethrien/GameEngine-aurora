//=====================================
export const createRandomShortString = () =>
  "_" + Math.random().toString(36).substring(2, 9);
//=====================================
export const nameToUpper = (name: string) =>
  [name[0].toUpperCase(), name.slice(1)].toString().replace(",", "");
//=====================================
export const normalizeColor = (color: number[]) =>
  color.map((value) => value / 255);
//=====================================
export const randomColor = (): RGB => [
  Math.floor(Math.random() * 256),
  Math.floor(Math.random() * 256),
  Math.floor(Math.random() * 256),
];
export function validateValue(value: unknown, message?: string): asserts value {
  if (!value) {
    throw new Error(message ?? "value not valid");
  }
}
