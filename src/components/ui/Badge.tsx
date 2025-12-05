interface BadgeProps {
  children: React.ReactNode;
  variant?: "new" | "hd" | "4k" | "default";
  className?: string;
}

export default function Badge({ children, variant = "default", className = "" }: BadgeProps) {
  const variants = {
    new: "bg-red-600 text-white",
    hd: "bg-blue-600 text-white",
    "4k": "bg-purple-600 text-white",
    default: "bg-zinc-800 text-zinc-200",
  };

  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-bold uppercase shadow-lg ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
