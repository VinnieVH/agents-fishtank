/** Where the treasure chest (the Copilot credits) stands, in a tank `width` wide. Every foreground keeps it in sight. */
export const chestSpot = (width: number) => width * .2;

/** The stretches of the floor kept free of things in front (the reef's outcrops, the ruined temple), so the chest stays in sight. */
export const keepClear = (width: number): [number, number][] => {
  const chest = chestSpot(width);
  return [[chest - 52, chest + 74]];
};

export const isClear = (clear: [number, number][], from: number, to: number) => !clear.some(([start, end]) => to > start && from < end);
