import { PublicLayout } from "@/components/layouts/public-layout";

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <PublicLayout>
      <div className="relative flex min-h-[calc(100vh-10rem)] items-center justify-center px-4 py-12">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] via-transparent to-transparent" />

        <div className="relative w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
            {subtitle && (
              <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
            )}
          </div>

          <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm ring-1 ring-foreground/[0.03] sm:p-8">
            {children}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
