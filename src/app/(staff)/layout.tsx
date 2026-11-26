import { Suspense } from "react";
import { StaffHeader } from "@/components/staff/staff-header";

export default function StaffLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header
        data-print="hide"
        className="border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 sm:sticky sm:top-0 sm:z-20"
      >
        <Suspense fallback={<div className="h-15" />}>
          <StaffHeader />
        </Suspense>
      </header>
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 py-8 print:max-w-none print:p-0">
        {children}
      </div>
    </>
  );
}
