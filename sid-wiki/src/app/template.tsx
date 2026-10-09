/** Re-monté à chaque navigation : fait apparaître chaque page en fondu. */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="reveal">{children}</div>;
}
