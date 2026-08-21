// A guild with just its founder still hasn't grown into a proper multi-member
// outfit - flavor it as a "Warband" instead of a "Guild" in UI chrome that
// refers to the player's own band, until other members join.
export function bandWord(memberCount: number, capitalize = true): string {
  const word = memberCount <= 1 ? "warband" : "guild";
  return capitalize ? word[0].toUpperCase() + word.slice(1) : word;
}
