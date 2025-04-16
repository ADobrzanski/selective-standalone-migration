export function isNil(x: unknown): x is null | undefined {
  return x === null || x === undefined;
}

export const isPrimitive = (
  x: unknown,
): x is null | undefined | number | string | boolean =>
  isNil(x) || ["number", "string", "boolean"].includes(typeof x);

export const isObject = (x: unknown): x is {} => {
  return x !== null && typeof x === "object";
};
