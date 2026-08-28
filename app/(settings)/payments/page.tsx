"use client";

import { Card, PageHeader, PillButton } from "@/components/ui";

export default function PaymentsPage() {
  return (
    <div className="mx-auto max-w-[900px] px-8 py-7">
      <PageHeader
        title="Payments"
        subtitle="Payment methods on your account."
      />

      <Card className="px-5 py-8 text-center">
        <div className="text-[14px] font-medium">No payment method</div>
        <div className="mt-1 text-[13px] text-ink-soft">
          Add a card to upgrade your plan and buy credits.
        </div>
        <div className="mt-4">
          <PillButton>Add payment method</PillButton>
        </div>
      </Card>
    </div>
  );
}
