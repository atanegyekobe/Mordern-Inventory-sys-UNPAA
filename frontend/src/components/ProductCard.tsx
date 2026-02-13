type ProductCardProps = {
  name: string;
  price: string;
  tag: string;
  accent: string;
};

export default function ProductCard({ name, price, tag, accent }: ProductCardProps) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-black/10 bg-white">
      <div className={`h-44 ${accent} transition duration-500 group-hover:scale-[1.02]`} />
      <div className="flex flex-1 flex-col gap-3 p-6">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-black/60">
          {tag}
        </span>
        <h3 className="text-xl font-semibold">{name}</h3>
        <p className="text-lg font-semibold text-black/80">{price}</p>
        <button className="mt-auto rounded-full border border-black/15 px-4 py-2 text-sm font-semibold transition hover:border-black/30">
          View details
        </button>
      </div>
    </article>
  );
}
