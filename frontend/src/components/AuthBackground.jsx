/**
 * A warm, layered dark background used behind the Login and Setup Wizard
 * screens — replaces a flat solid color with a subtle gradient, soft glow
 * accents, and a faint dot-grid texture, all pure CSS (no image assets).
 */
export default function AuthBackground({ children }) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-ink-950 via-ink-900 to-[#16302B] flex items-center justify-center px-4 py-10">
      {/* Soft glow accents */}
      <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-brass-500/20 blur-[110px]" />
      <div className="pointer-events-none absolute -bottom-40 -left-24 h-[28rem] w-[28rem] rounded-full bg-emerald-700/15 blur-[120px]" />

      {/* Faint dot-grid texture */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage: 'radial-gradient(rgba(243,238,225,0.8) 1px, transparent 1px)',
          backgroundSize: '22px 22px'
        }}
      />

      <div className="relative z-10 w-full flex justify-center">{children}</div>
    </div>
  );
}
