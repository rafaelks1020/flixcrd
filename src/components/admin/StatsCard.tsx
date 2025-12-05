"use client";

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: string;
  trend?: {
    value: string;
    isPositive: boolean;
  };
  color?: "blue" | "green" | "purple" | "orange" | "red";
}

export default function StatsCard({ title, value, icon, trend, color = "blue" }: StatsCardProps) {
  const colorClasses = {
    blue: "from-blue-500/20 to-blue-600/5 border-blue-500/30",
    green: "from-emerald-500/20 to-emerald-600/5 border-emerald-500/30",
    purple: "from-purple-500/20 to-purple-600/5 border-purple-500/30",
    orange: "from-orange-500/20 to-orange-600/5 border-orange-500/30",
    red: "from-red-500/20 to-red-600/5 border-red-500/30",
  };

  const iconColorClasses = {
    blue: "bg-blue-500/20 text-blue-400",
    green: "bg-emerald-500/20 text-emerald-400",
    purple: "bg-purple-500/20 text-purple-400",
    orange: "bg-orange-500/20 text-orange-400",
    red: "bg-red-500/20 text-red-400",
  };

  return (
    <div className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${colorClasses[color]} p-6 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-lg`}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">
            {title}
          </p>
          <p className="mt-2 text-3xl font-bold text-zinc-50">
            {value}
          </p>
          {trend && (
            <p className={`mt-2 text-xs font-semibold ${trend.isPositive ? "text-emerald-400" : "text-red-400"}`}>
              {trend.isPositive ? "↗" : "↘"} {trend.value}
            </p>
          )}
        </div>
        <div className={`rounded-lg p-3 ${iconColorClasses[color]}`}>
          <span className="text-2xl">{icon}</span>
        </div>
      </div>
    </div>
  );
}
