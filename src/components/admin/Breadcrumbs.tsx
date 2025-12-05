"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Breadcrumbs() {
  const pathname = usePathname();
  
  const paths = pathname.split("/").filter(Boolean);
  
  const breadcrumbs = paths.map((path, index) => {
    const href = "/" + paths.slice(0, index + 1).join("/");
    const label = path
      .split("-")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
    
    return { href, label };
  });

  if (breadcrumbs.length <= 1) return null;

  return (
    <div className="mb-4 flex items-center gap-2 text-sm text-zinc-400">
      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.href} className="flex items-center gap-2">
          {index > 0 && <span>/</span>}
          {index === breadcrumbs.length - 1 ? (
            <span className="text-zinc-100">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="hover:text-zinc-100 transition-colors"
            >
              {crumb.label}
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}
