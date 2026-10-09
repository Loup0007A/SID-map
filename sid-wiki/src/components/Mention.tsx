export default function Mention({ nickname }: { nickname: string }) {
  return (
    <span className="mx-0.5 inline-block rounded-full border border-white/15 bg-brass-300/70 px-2 py-0 align-baseline font-typewriter text-[0.95em] font-bold text-night shadow-sm">
      @{nickname}
    </span>
  );
}
