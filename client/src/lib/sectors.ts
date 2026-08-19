// Display-only mirror of server/src/sectors.ts - the server decides which
// ticker belongs to which sector and sends the key; this just maps that key
// to a name/icon for rendering.
export const SECTOR_INFO: Record<string, { name: string; icon: string }> = {
  tech: { name: "Technology", icon: "💻" },
  finance: { name: "Finance", icon: "🏦" },
  energy: { name: "Energy", icon: "🛢️" },
  consumer: { name: "Consumer", icon: "🛒" },
  industrial: { name: "Industrial", icon: "⚙️" },
  index: { name: "Index", icon: "📊" },
};
