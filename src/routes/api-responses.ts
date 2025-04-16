export const noElementWithId = (id: unknown) => ({
  details: `No element with ID equal ${id}.`,
});

export const notOfType = (opts: { type: string; id: unknown }) => ({
  details: `Element with ID equal ${opts.id} is not ${opts.type}.`,
});
