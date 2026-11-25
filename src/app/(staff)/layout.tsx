import { Suspense } from "react";
import { StaffHeader } from "@/components/staff/staff-header";

export default function StaffLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header data-print="hide" className="border-b bg-card">
        <Suspense fallback={<div className="h-15" />}>
          <StaffHeader />
        </Suspense>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8">
        {children}
      </div>
    </>
  );
}
