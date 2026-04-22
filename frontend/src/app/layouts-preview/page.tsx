"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PublicLayout } from "@/components/layouts/public-layout";
import { FamilyLayout } from "@/components/layouts/family-layout";
import { CaregiverLayout } from "@/components/layouts/caregiver-layout";
import { AdminLayout } from "@/components/layouts/admin-layout";

type LayoutType = "public" | "family" | "caregiver" | "admin";

function DemoContent({ layout }: { layout: LayoutType }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-2">
          {layout === "public" && "Welcome to KindredCare"}
          {layout === "family" && "Family Dashboard"}
          {layout === "caregiver" && "Caregiver Dashboard"}
          {layout === "admin" && "Admin Dashboard"}
        </h1>
        <p className="text-muted-foreground">
          This is a preview of the <Badge variant="outline">{layout}</Badge> layout shell.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <CardTitle className="text-base">Sample Card {i}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This content sits inside the {layout} layout. Resize the browser to see responsive
                behavior.
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function LayoutsPreviewPage() {
  const [activeLayout, setActiveLayout] = useState<LayoutType>("public");

  const layouts: { key: LayoutType; label: string }[] = [
    { key: "public", label: "Public" },
    { key: "family", label: "Family" },
    { key: "caregiver", label: "Caregiver" },
    { key: "admin", label: "Admin" },
  ];

  const LayoutWrapper = {
    public: PublicLayout,
    family: FamilyLayout,
    caregiver: CaregiverLayout,
    admin: AdminLayout,
  }[activeLayout];

  return (
    <div>
      {/* Layout switcher — fixed at very top */}
      <div className="fixed inset-x-0 top-0 z-[60] flex items-center justify-center gap-2 bg-foreground px-4 py-2">
        {layouts.map((l) => (
          <Button
            key={l.key}
            variant={activeLayout === l.key ? "default" : "ghost"}
            size="xs"
            onClick={() => setActiveLayout(l.key)}
            className={
              activeLayout === l.key
                ? "bg-background text-foreground hover:bg-background/90"
                : "text-background/80 hover:text-background hover:bg-background/10"
            }
          >
            {l.label}
          </Button>
        ))}
      </div>

      {/* Add top padding to account for the switcher bar */}
      <div className="pt-10">
        <LayoutWrapper>
          <DemoContent layout={activeLayout} />
        </LayoutWrapper>
      </div>
    </div>
  );
}
