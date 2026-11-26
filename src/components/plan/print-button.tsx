"use client";

import { PrinterIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Opens the browser's print dialog; it can also save the plan as PDF. */
export function PrintButton() {
  return (
    // The page's main action, so it carries the one accent colour ("crust").
    <Button
      className="bg-crust text-crust-foreground hover:bg-crust/90"
      onClick={() => window.print()}
    >
      <PrinterIcon />
      Tisk
    </Button>
  );
}
